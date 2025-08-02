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

// GET: 보유종목 목록 조회 (거래내역 기반 실시간 계산)
export async function GET(request: NextRequest) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 사용자의 모든 거래내역 조회
    const transactions = await prisma.transaction.findMany({
      where: {
        account: {
          userId: userId,
        },
        OR: [
          { transactionType: 'BUY' },
          { transactionType: 'SELL' }
        ]
      },
      include: {
        account: {
          include: {
            institution: true,
          },
        },
      },
      orderBy: {
        transactionDate: 'asc',
      },
    });

    // 종목별로 거래내역을 그룹화하고 계산
    const holdingsMap = new Map();

    transactions.forEach(transaction => {
      if (!transaction.stockCode) return;

      const key = `${transaction.accountId}_${transaction.stockCode}`;
      
      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, {
          id: `holding_${key}`,
          accountId: transaction.accountId,
          stockCode: transaction.stockCode,
          stockName: transaction.stockName || '',
          quantity: 0,
          totalInvestment: 0, // 총 투자금액
          averagePrice: 0,
          currency: transaction.currency || 'KRW',
          updatedAt: transaction.transactionDate,
          account: transaction.account,
          stock: {
            id: `stock_${transaction.stockCode}`,
            stockCode: transaction.stockCode,
            stockName: transaction.stockName || '',
            market: transaction.currency === 'USD' ? 'NASDAQ' : 'KOSPI',
            currency: transaction.currency || 'KRW',
            currentPrice: null
          }
        });
      }

      const holding = holdingsMap.get(key);
      
      if (transaction.transactionType === 'BUY') {
        // 매수: 수량 증가, 평단가 재계산
        const newQuantity = holding.quantity + (transaction.quantity || 0);
        const newTotalInvestment = holding.totalInvestment + (transaction.totalAmount || 0);
        
        holding.quantity = newQuantity;
        holding.totalInvestment = newTotalInvestment;
        holding.averagePrice = newQuantity > 0 ? newTotalInvestment / newQuantity : 0;
      } else if (transaction.transactionType === 'SELL') {
        // 매도: 수량 감소, 평단가는 유지 (평단가 기준으로 투자금액 감소)
        const sellQuantity = transaction.quantity || 0;
        const avgPrice = holding.quantity > 0 ? holding.totalInvestment / holding.quantity : 0;
        
        holding.quantity = Math.max(0, holding.quantity - sellQuantity);
        
        // 매도한 수량만큼 투자금액 감소 (평단가 기준)
        holding.totalInvestment = holding.quantity * avgPrice;
        holding.averagePrice = holding.quantity > 0 ? holding.totalInvestment / holding.quantity : 0;
      }
      
      holding.updatedAt = transaction.transactionDate;
    });

    // 수량이 0보다 큰 보유종목만 필터링
    const activeHoldings = Array.from(holdingsMap.values())
      .filter(holding => holding.quantity > 0)
      .map(holding => ({
        ...holding,
        totalAmount: holding.quantity * holding.averagePrice, // 총 평가금액 (현재가 없으므로 평단가 기준)
        currentPrice: holding.averagePrice // 임시로 평단가를 현재가로 사용
      }));

    return NextResponse.json({ holdings: activeHoldings });
  } catch (error) {
    console.error('Failed to fetch holdings:', error);
    return NextResponse.json(
      { error: '보유종목 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
