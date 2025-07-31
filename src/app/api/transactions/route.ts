import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JwtPayload {
  userId: string;
  email: string;
}

function getUserFromToken(request: NextRequest): string | null {
  // 먼저 auth-token 쿠키를 확인
  let token = request.cookies.get('auth-token')?.value;
  
  // auth-token이 없으면 token 쿠키를 확인
  if (!token) {
    token = request.cookies.get('token')?.value;
  }
  
  console.log('사용 가능한 쿠키들:', request.cookies.getAll().map(c => c.name));
  console.log('추출한 토큰:', token ? '존재함' : '없음');
  
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    console.log('토큰에서 추출한 사용자 ID:', payload.userId);
    return payload.userId;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// GET: 거래 내역 목록 조회
export async function GET(request: NextRequest) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const type = searchParams.get('type');

    const whereClause: {
      account: { userId: string };
      accountId?: string;
      transactionType?: 'BUY' | 'SELL' | 'DIVIDEND';
    } = {
      account: {
        userId: userId,
      },
    };

    if (accountId && accountId !== 'all') {
      whereClause.accountId = accountId;
    }

    if (type && type !== 'all') {
      whereClause.transactionType = type as 'BUY' | 'SELL' | 'DIVIDEND';
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        account: {
          include: {
            institution: true,
          },
        },
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      { error: '거래 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 거래 내역 추가
export async function POST(request: NextRequest) {
  console.log('POST /api/transactions 호출됨');
  
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      console.log('인증 실패');
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    console.log('인증 성공, userId:', userId);

    const body = await request.json();
    console.log('요청 본문:', body);

    const { 
      accountId, 
      type,
      date,
      stockCode, 
      stockName, 
      quantity, 
      price,
      amount,
      currency,
      fee = 0
    } = body;

    // 기본 필수 필드 검증
    if (!accountId || !type || !date || !amount || !currency) {
      console.log('필수 필드 누락');
      return NextResponse.json(
        { error: '필수 필드를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    console.log('기본 필드 검증 통과');

    // 매수/매도 거래의 경우 추가 필드 검증
    if ((type === 'BUY' || type === 'SELL') && (!stockCode || !stockName || !quantity || !price)) {
      console.log('매수/매도 필수 필드 누락');
      return NextResponse.json(
        { error: '매수/매도 거래는 종목코드, 종목명, 수량, 가격을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 계좌 소유권 확인
    console.log('계좌 조회 시도:', { accountId, userId });
    
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: userId,
      },
    });

    console.log('계좌 조회 결과:', account);

    if (!account) {
      // 계좌가 존재하는지만 확인
      const accountExists = await prisma.account.findFirst({
        where: {
          id: accountId,
        },
      });
      console.log('계좌 존재 여부:', accountExists);
      
      // 사용자의 모든 계좌 확인
      const userAccounts = await prisma.account.findMany({
        where: {
          userId: userId,
        },
        select: {
          id: true,
          accountNumber: true,
        },
      });
      console.log('사용자 계좌 목록:', userAccounts);
      
      console.log('계좌를 찾을 수 없음 - 사용자 ID 불일치');
      console.log('요청 사용자 ID:', userId);
      console.log('계좌 소유자 ID:', accountExists?.userId);
      return NextResponse.json(
        { 
          error: '본인 소유가 아닌 계좌입니다. 로그아웃 후 다시 로그인해주세요.',
          details: {
            requestUserId: userId,
            accountOwnerId: accountExists?.userId,
            accountId: accountId
          }
        },
        { status: 403 }
      );
    }

    console.log('계좌 확인 완료');

    // 모든 거래에 필요한 stockCode, stockName, quantity, price 설정
    let finalStockCode = stockCode;
    let finalStockName = stockName;
    let finalQuantity = quantity;
    let finalPrice = price;

    // 매수/매도가 아닌 경우 기본값 설정
    if (type === 'DIVIDEND') {
      finalStockCode = finalStockCode || 'DIVIDEND';
      finalStockName = finalStockName || '배당금';
      finalQuantity = 1;
      finalPrice = amount;
    } else if (type === 'DEPOSIT') {
      finalStockCode = 'CASH';
      finalStockName = '입금';
      finalQuantity = 1;
      finalPrice = amount;
    } else if (type === 'WITHDRAWAL') {
      finalStockCode = 'CASH';
      finalStockName = '출금';
      finalQuantity = 1;
      finalPrice = amount;
    }

    // 필수 필드 검증
    if (!finalStockCode || !finalStockName || finalQuantity === undefined || finalPrice === undefined) {
      console.log('최종 필드 검증 실패');
      return NextResponse.json(
        { 
          message: '종목코드, 종목명, 수량, 가격은 필수입니다',
          error: 'MISSING_REQUIRED_FIELDS'
        },
        { status: 400 }
      );
    }

    const transactionCreateData = {
      accountId: accountId,
      stockCode: finalStockCode,
      stockName: finalStockName,
      transactionType: type,
      quantity: parseInt(finalQuantity.toString()),
      price: parseFloat(finalPrice.toString()),
      totalAmount: amount,
      fees: fee,
      currency: currency,
      transactionDate: new Date(date),
    };

    console.log('거래 생성 데이터:', transactionCreateData);

    const transaction = await prisma.transaction.create({
      data: transactionCreateData,
      include: {
        account: {
          include: {
            institution: true,
          },
        },
      },
    });

    console.log('거래 생성 완료:', transaction.id);

    // 거래 유형에 따라 보유종목 업데이트
    if (type === 'BUY') {
      // 매수: 보유종목 추가 또는 업데이트
      const existingHolding = await prisma.holding.findFirst({
        where: {
          accountId: accountId,
          stockCode: stockCode,
        },
      });

      if (existingHolding) {
        // 기존 보유종목이 있으면 수량과 평균단가 업데이트
        const totalQuantity = existingHolding.quantity + quantity;
        const totalValue = (existingHolding.quantity * existingHolding.averagePrice) + (quantity * price);
        const newAveragePrice = totalValue / totalQuantity;

        await prisma.holding.update({
          where: { id: existingHolding.id },
          data: {
            quantity: totalQuantity,
            averagePrice: newAveragePrice,
          },
        });
        console.log('기존 보유종목 업데이트 완료');
      } else {
        // 새 보유종목 생성
        await prisma.holding.create({
          data: {
            accountId: accountId,
            stockCode: stockCode,
            stockName: stockName,
            quantity: quantity,
            averagePrice: price,
          },
        });
        console.log('새 보유종목 생성 완료');
      }
    } else if (type === 'SELL') {
      // 매도: 보유종목 수량 감소
      const existingHolding = await prisma.holding.findFirst({
        where: {
          accountId: accountId,
          stockCode: stockCode,
        },
      });

      if (existingHolding) {
        const newQuantity = existingHolding.quantity - quantity;
        
        if (newQuantity <= 0) {
          // 보유수량이 0이 되면 삭제
          await prisma.holding.delete({
            where: { id: existingHolding.id },
          });
          console.log('보유종목 삭제 완료');
        } else {
          // 수량만 업데이트 (평균단가는 유지)
          await prisma.holding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: newQuantity,
            },
          });
          console.log('보유종목 수량 업데이트 완료');
        }
      }
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error('Failed to create transaction:', error);
    return NextResponse.json(
      { error: '거래 내역 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
