import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JwtPayload {
  userId: string;
  email: string;
}

function getUserFromToken(request: NextRequest): string | null {
  let token = request.cookies.get('auth-token')?.value;
  
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

// 거래내역으로부터 보유종목 재계산
export async function POST(request: NextRequest) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { accountId, stockCode } = await request.json();

    // 사용자의 모든 계좌에서 해당 종목의 거래내역 조회
    interface WhereClause {
      account: { userId: string };
      transactionType: { in: ('BUY' | 'SELL')[] };
      accountId?: string;
      stockCode?: string;
    }
    
    const whereClause: WhereClause = {
      account: {
        userId: userId,
      },
      transactionType: {
        in: ['BUY', 'SELL']
      }
    };

    if (accountId) {
      whereClause.accountId = accountId;
    }

    if (stockCode) {
      whereClause.stockCode = stockCode;
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: {
        transactionDate: 'asc'
      },
      include: {
        account: true
      }
    });

    // 계좌별, 종목별로 그룹화하여 계산
    const holdingsMap = new Map<string, {
      accountId: string;
      stockCode: string;
      stockName: string;
      quantity: number;
      totalCost: number;
      averagePrice: number;
      currency: string;
    }>();

    for (const transaction of transactions) {
      const key = `${transaction.accountId}-${transaction.stockCode}`;
      const existing = holdingsMap.get(key);

      if (transaction.transactionType === 'BUY') {
        const cost = (transaction.quantity || 0) * (transaction.price || 0) + (transaction.fees || 0);
        
        if (existing) {
          const newQuantity = existing.quantity + (transaction.quantity || 0);
          const newTotalCost = existing.totalCost + cost;
          
          holdingsMap.set(key, {
            ...existing,
            quantity: newQuantity,
            totalCost: newTotalCost,
            averagePrice: newQuantity > 0 ? newTotalCost / newQuantity : 0
          });
        } else {
          holdingsMap.set(key, {
            accountId: transaction.accountId,
            stockCode: transaction.stockCode,
            stockName: transaction.stockName || '',
            quantity: transaction.quantity || 0,
            totalCost: cost,
            averagePrice: transaction.price || 0,
            currency: transaction.currency || 'KRW'
          });
        }
      } else if (transaction.transactionType === 'SELL') {
        if (existing) {
          const newQuantity = Math.max(0, existing.quantity - (transaction.quantity || 0));
          
          if (newQuantity === 0) {
            holdingsMap.delete(key);
          } else {
            // FIFO 방식으로 평균단가 유지
            holdingsMap.set(key, {
              ...existing,
              quantity: newQuantity
            });
          }
        }
      }
    }

    // 기존 보유종목 삭제 (재계산된 데이터로 교체)
    if (accountId && stockCode) {
      await prisma.holding.deleteMany({
        where: {
          accountId: accountId,
          stockCode: stockCode,
          account: {
            userId: userId
          }
        }
      });
    } else if (accountId) {
      await prisma.holding.deleteMany({
        where: {
          accountId: accountId,
          account: {
            userId: userId
          }
        }
      });
    } else {
      await prisma.holding.deleteMany({
        where: {
          account: {
            userId: userId
          }
        }
      });
    }

    // 새로운 보유종목 데이터 생성
    const newHoldings = [];
    for (const holding of holdingsMap.values()) {
      if (holding.quantity > 0) {
        const newHolding = await prisma.holding.create({
          data: {
            accountId: holding.accountId,
            stockCode: holding.stockCode,
            stockName: holding.stockName,
            quantity: holding.quantity,
            averagePrice: holding.averagePrice,
            currency: holding.currency,
          },
          include: {
            account: {
              include: {
                institution: true
              }
            }
          }
        });
        newHoldings.push(newHolding);
      }
    }

    return NextResponse.json({ 
      message: '보유종목이 거래내역을 기반으로 재계산되었습니다.',
      holdings: newHoldings,
      recalculatedCount: newHoldings.length
    });

  } catch (error) {
    console.error('Failed to recalculate holdings:', error);
    return NextResponse.json(
      { error: '보유종목 재계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
