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
  
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return payload.userId;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// DELETE: 거래 내역 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { transactionId } = params;

    // 거래 내역 존재 및 소유권 확인
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        account: {
          userId: userId,
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: '거래 내역을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 삭제할 거래의 정보 저장 (삭제 후 보유종목 재계산에 필요)
    const { accountId, stockCode, transactionType } = transaction;
    
    // 거래 내역 삭제
    await prisma.transaction.delete({
      where: {
        id: transactionId,
      },
    });

    // 매수/매도 거래였다면 해당 종목의 보유종목 재계산
    if ((transactionType === 'BUY' || transactionType === 'SELL') && stockCode) {
      await recalculateHoldingsForStock(accountId, stockCode);
    }

    return NextResponse.json({ message: '거래 내역이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    return NextResponse.json(
      { error: '거래 내역 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 거래 내역 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { transactionId } = params;
    const body = await request.json();

    // 기존 거래 내역 확인
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        account: {
          userId: userId,
        },
      },
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: '거래 내역을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { 
      type,
      date,
      accountId, 
      stockCode, 
      stockName, 
      quantity, 
      price, 
      amount, 
      currency, 
      fee
    } = body;

    // 필수 필드 검증
    if (!type || !date || !accountId || !amount) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 계좌 소유권 확인
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: '계좌를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 거래 내역 업데이트
    const updatedTransaction = await prisma.transaction.update({
      where: {
        id: transactionId,
      },
      data: {
        accountId,
        stockCode: stockCode || '',
        stockName: stockName || '',
        transactionType: type,
        quantity: quantity || 0,
        price: price || 0,
        totalAmount: amount,
        fees: fee || 0,
        currency: currency || 'KRW',
        transactionDate: new Date(date),
      },
    });

    // 거래내역 수정 후 해당 종목의 보유종목 재계산
    if ((type === 'BUY' || type === 'SELL') && stockCode) {
      await recalculateHoldingsForStock(accountId, stockCode);
    }

    return NextResponse.json({ 
      message: '거래 내역이 성공적으로 수정되었습니다.',
      transaction: updatedTransaction 
    });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    return NextResponse.json(
      { error: '거래 내역 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 특정 종목의 보유종목을 거래내역 기반으로 재계산하는 함수
async function recalculateHoldingsForStock(accountId: string, stockCode: string) {
  try {
    // 해당 계좌의 해당 종목 거래내역을 모두 조회
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: accountId,
        stockCode: stockCode,
        OR: [
          { transactionType: 'BUY' },
          { transactionType: 'SELL' }
        ]
      },
      orderBy: {
        transactionDate: 'asc',
      },
    });

    let totalQuantity = 0;
    let totalInvestment = 0;

    // 거래내역을 순차적으로 처리하여 보유수량과 평단가 계산
    transactions.forEach(transaction => {
      if (transaction.transactionType === 'BUY') {
        totalQuantity += transaction.quantity;
        totalInvestment += transaction.totalAmount;
      } else if (transaction.transactionType === 'SELL') {
        const sellQuantity = transaction.quantity;
        const sellRatio = sellQuantity / totalQuantity;
        
        totalQuantity -= sellQuantity;
        totalInvestment *= (1 - sellRatio); // 매도 비율만큼 투자금액 감소
      }
    });

    const averagePrice = totalQuantity > 0 ? totalInvestment / totalQuantity : 0;

    // 기존 보유종목 조회
    const existingHolding = await prisma.holding.findFirst({
      where: {
        accountId: accountId,
        stockCode: stockCode,
      },
    });

    if (totalQuantity > 0) {
      if (existingHolding) {
        // 기존 보유종목 업데이트
        await prisma.holding.update({
          where: { id: existingHolding.id },
          data: {
            quantity: totalQuantity,
            averagePrice: averagePrice,
            stockName: transactions[transactions.length - 1]?.stockName || existingHolding.stockName,
            currency: transactions[transactions.length - 1]?.currency || existingHolding.currency,
          },
        });
      } else {
        // 새 보유종목 생성
        const latestTransaction = transactions[transactions.length - 1];
        await prisma.holding.create({
          data: {
            accountId: accountId,
            stockCode: stockCode,
            stockName: latestTransaction?.stockName || '',
            quantity: totalQuantity,
            averagePrice: averagePrice,
            currency: latestTransaction?.currency || 'KRW',
          },
        });
      }
    } else if (existingHolding) {
      // 보유수량이 0이면 기존 보유종목 삭제
      await prisma.holding.delete({
        where: { id: existingHolding.id },
      });
    }

    console.log(`보유종목 재계산 완료 - ${stockCode}: 수량 ${totalQuantity}, 평단가 ${averagePrice}`);
  } catch (error) {
    console.error('Failed to recalculate holdings:', error);
  }
}
