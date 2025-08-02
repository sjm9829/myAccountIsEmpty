import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getPreviousTradingDay, isAfterMarketClose } from '@/utils/dateUtils';

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

// 실제 주가 데이터를 가져오는 함수 (현재가와 전일종가 포함)
async function getStockPriceData(stockCode: string, currency: string = 'KRW'): Promise<{
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
}> {
  try {
    // 한국 주식인지 확인 (6자리 숫자)
    const isKoreanStock = /^\d{6}$/.test(stockCode);
    // M0으로 시작하는 금속 선물인지 확인 (야후에서 지원하지 않음)
    const isMetalFutures = /^M0\d{7}$/.test(stockCode);
    // 미국 주식인지 확인 (영문자)
    const isUSStock = /^[A-Z]{1,5}$/.test(stockCode) && currency === 'USD';
    
    console.log(`getStockPriceData for: ${stockCode}, currency: ${currency}, isKoreanStock: ${isKoreanStock}, isMetalFutures: ${isMetalFutures}, isUSStock: ${isUSStock}`);
    
    // 주말/휴장일 체크
    const now = new Date();
    const afterMarketClose = isAfterMarketClose(stockCode);
    const previousTradingDay = getPreviousTradingDay(stockCode, now);
    
    console.log(`Market status for ${stockCode}:`, {
      afterMarketClose,
      currentTime: now.toISOString(),
      previousTradingDay: previousTradingDay.toISOString().split('T')[0]
    });
    
    // 현재 요청의 base URL을 사용하여 API 호출
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
    
    if (isUSStock) {
      // 미국 주식은 Yahoo Finance API 사용
      try {
        console.log(`Fetching US stock data for: ${stockCode}`);
        const response = await fetch(`${baseUrl}/api/stock-data/yahoo?symbol=${stockCode}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Yahoo API response for ${stockCode}:`, data);
          
          if (data.regularMarketPrice && data.regularMarketPrice > 0) {
            // 주말/휴장일에는 이전 영업일 기준으로 계산
            let previousClose = data.previousClose || data.regularMarketPreviousClose || data.regularMarketPrice;
            let change = data.regularMarketChange || 0;
            let changePercent = data.regularMarketChangePercent || 0;
            
            // 주말이나 휴장일에는 데이터가 다를 수 있으므로 재계산
            if (afterMarketClose && data.previousTradingDayData) {
              previousClose = data.previousTradingDayData.close;
              change = data.regularMarketPrice - previousClose;
              changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
            }
            
            return {
              currentPrice: data.regularMarketPrice,
              previousClose,
              change,
              changePercent
            };
          }
        } else {
          console.warn(`Yahoo API failed for ${stockCode} with status: ${response.status}`);
        }
      } catch (error) {
        console.error(`Yahoo API error for ${stockCode}:`, error);
      }
    } else if (isKoreanStock || isMetalFutures) {
      // M0으로 시작하는 금속 선물은 야후를 건너뛰고 바로 네이버나 한국 API로
      if (!isMetalFutures) {
        // 일반 한국 주식은 기존 Korean API 사용
        const response = await fetch(`${baseUrl}/api/stock-data/korean?symbol=${stockCode}`);
        if (response.ok) {
          const data = await response.json();
          const currentPrice = data.regularMarketPrice || 0;
          let previousClose = data.previousClose || currentPrice;
          let change = currentPrice - previousClose;
          let changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
          
          // 주말/휴장일에는 전일 대비 계산이 0이 될 수 있으므로 Yahoo Finance로 대체 시도
          if (afterMarketClose && (change === 0 || changePercent === 0)) {
            try {
              console.log(`Trying Yahoo Finance for Korean stock ${stockCode} due to weekend/holiday`);
              const yahooResponse = await fetch(`${baseUrl}/api/stock-data/yahoo?symbol=${stockCode}`);
              if (yahooResponse.ok) {
                const yahooData = await yahooResponse.json();
                if (yahooData.regularMarketChange && yahooData.regularMarketChangePercent) {
                  change = yahooData.regularMarketChange;
                  changePercent = yahooData.regularMarketChangePercent;
                  previousClose = currentPrice - change;
                }
              }
            } catch (error) {
              console.warn(`Yahoo fallback failed for ${stockCode}:`, error);
            }
          }
          
          return {
            currentPrice,
            previousClose,
            change,
            changePercent
          };
        }
      } else {
        console.log(`Skipping Yahoo Finance for metal futures in holdings API: ${stockCode}`);
        // 금속 선물은 네이버 API를 먼저 시도
        try {
          const response = await fetch(`${baseUrl}/api/stock-data/naver?symbol=${stockCode}`);
          if (response.ok) {
            const data = await response.json();
            const currentPrice = data.regularMarketPrice || 0;
            const previousClose = data.previousClose || currentPrice;
            const change = currentPrice - previousClose;
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
            
            return {
              currentPrice,
              previousClose,
              change,
              changePercent
            };
          }
        } catch (error) {
          console.warn(`Naver API failed for ${stockCode} in holdings:`, error);
        }
      }
    } else {
      // 해외 주식의 경우 Yahoo Finance API 사용
      const response = await fetch(`${baseUrl}/api/stock-data/yahoo?symbol=${stockCode}`);
      if (response.ok) {
        const data = await response.json();
        const currentPrice = data.regularMarketPrice || 0;
        let previousClose = data.previousClose || data.regularMarketPreviousClose || currentPrice;
        let change = data.regularMarketChange || 0;
        let changePercent = data.regularMarketChangePercent || 0;
        
        // 주말/휴장일에는 이전 영업일 기준으로 계산
        if (afterMarketClose && data.previousTradingDayData) {
          previousClose = data.previousTradingDayData.close;
          change = currentPrice - previousClose;
          changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        }
        
        return {
          currentPrice,
          previousClose,
          change,
          changePercent
        };
      }
    }
  } catch (error) {
    console.error(`Failed to fetch price data for ${stockCode}:`, error);
  }
  
  // API 호출 실패 시 기본값 반환
  return {
    currentPrice: 0,
    previousClose: 0,
    change: 0,
    changePercent: 0
  };
}

// GET: 보유종목 목록 조회
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
    const limit = searchParams.get('limit');

    const whereClause: {
      account: {
        userId: string;
      };
      accountId?: string;
    } = {
      account: {
        userId: userId,
      },
    };

    if (accountId && accountId !== 'all') {
      whereClause.accountId = accountId;
    }

    const queryOptions = {
      where: whereClause,
      include: {
        account: {
          include: {
            institution: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc' as const,
      },
      ...(limit && !isNaN(parseInt(limit)) && { take: parseInt(limit) }),
    };

    const holdings = await prisma.holding.findMany(queryOptions);

    // 환율 정보 가져오기
    let exchangeRate = 1350; // 기본값
    try {
      const exchangeResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/exchange-rate`);
      if (exchangeResponse.ok) {
        const exchangeData = await exchangeResponse.json();
        exchangeRate = exchangeData.data.rate;
        console.log(`Using exchange rate: ${exchangeRate}`);
      }
    } catch (error) {
      console.warn('Failed to fetch exchange rate, using default:', error);
    }

    // Calculate current prices and portfolio metrics
    const enrichedHoldings = await Promise.all(holdings.map(async (holding) => {
      const priceData = await getStockPriceData(holding.stockCode, holding.currency || 'KRW');
      const currentPrice = priceData.currentPrice;
      const previousClose = priceData.previousClose;
      const dailyChange = priceData.change;
      const dailyChangePercent = priceData.changePercent;
      const currency = holding.currency || 'KRW';
      
      console.log(`Processing holding: ${holding.stockCode}, currency: ${currency}, currentPrice: ${currentPrice}, previousClose: ${previousClose}, dailyChange: ${dailyChange}, quantity: ${holding.quantity}, averagePrice: ${holding.averagePrice}`);
      
      // 보유종목별 계산 (각 자산의 원래 통화로)
      const totalValue = holding.quantity * currentPrice;
      const totalInvestment = holding.quantity * holding.averagePrice;
      const profitLoss = totalValue - totalInvestment;
      const profitLossPercentage = totalInvestment > 0 ? (profitLoss / totalInvestment) * 100 : 0;

      // 전일 대비 변동 금액 (보유수량 기준)
      const previousTotalValue = holding.quantity * previousClose;
      const todayChange = totalValue - previousTotalValue;
      const todayChangePercent = previousTotalValue > 0 ? (todayChange / previousTotalValue) * 100 : 0;

      // 원화 환산 값 (포트폴리오 전체 요약용)
      const totalValueKRW = currency === 'USD' ? totalValue * exchangeRate : totalValue;
      const totalInvestmentKRW = currency === 'USD' ? totalInvestment * exchangeRate : totalInvestment;
      const profitLossKRW = totalValueKRW - totalInvestmentKRW;
      const todayChangeKRW = currency === 'USD' ? todayChange * exchangeRate : todayChange;

      console.log(`  Original values: totalValue=${totalValue}, totalInvestment=${totalInvestment}, todayChange=${todayChange}`);
      console.log(`  KRW converted: totalValueKRW=${totalValueKRW}, totalInvestmentKRW=${totalInvestmentKRW}, todayChangeKRW=${todayChangeKRW}, exchangeRate=${exchangeRate}`);
      console.log(`  Applied exchange rate: ${currency === 'USD' ? 'YES' : 'NO'}`);
      console.log('---');

      return {
        ...holding,
        currentPrice,
        previousClose,
        dailyChange,
        dailyChangePercent,
        totalValue,
        totalInvestment,
        profitLoss,
        profitLossPercentage,
        todayChange,
        todayChangePercent,
        currency,
        // 원화 환산 값들 (전체 요약용)
        totalValueKRW,
        totalInvestmentKRW,
        profitLossKRW,
        todayChangeKRW,
      };
    }));

    // Calculate portfolio summary (모든 자산을 원화로 환산해서 합계)
    const totalValue = enrichedHoldings.reduce((sum, holding) => sum + holding.totalValueKRW, 0);
    const totalInvestment = enrichedHoldings.reduce((sum, holding) => sum + holding.totalInvestmentKRW, 0);
    const totalProfitLoss = totalValue - totalInvestment;
    const totalProfitLossPercentage = totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;
    
    // 전일 대비 변동 금액 (전체 포트폴리오 기준)
    const totalTodayChange = enrichedHoldings.reduce((sum, holding) => sum + holding.todayChangeKRW, 0);
    const previousTotalValue = totalValue - totalTodayChange;
    const totalTodayChangePercent = previousTotalValue > 0 ? (totalTodayChange / previousTotalValue) * 100 : 0;

    // 통화별 요약 정보도 제공
    const summaryByCurrency: Record<string, {
      totalValue: number;
      totalInvestment: number;
      totalProfitLoss: number;
      count: number;
    }> = {
      KRW: {
        totalValue: 0,
        totalInvestment: 0,
        totalProfitLoss: 0,
        count: 0
      },
      USD: {
        totalValue: 0,
        totalInvestment: 0,
        totalProfitLoss: 0,
        count: 0
      }
    };

    enrichedHoldings.forEach(holding => {
      const currency = holding.currency || 'KRW';
      if (summaryByCurrency[currency]) {
        summaryByCurrency[currency].totalValue += holding.totalValue;
        summaryByCurrency[currency].totalInvestment += holding.totalInvestment;
        summaryByCurrency[currency].totalProfitLoss += holding.profitLoss;
        summaryByCurrency[currency].count++;
      }
    });

    const summary = {
      totalValue,
      totalInvestment,
      totalProfitLoss,
      totalProfitLossPercentage,
      totalTodayChange,
      totalTodayChangePercent,
      exchangeRate,
      byCurrency: summaryByCurrency
    };

    return NextResponse.json({ 
      holdings: enrichedHoldings, 
      summary 
    });
  } catch (error) {
    console.error('Failed to fetch holdings:', error);
    return NextResponse.json(
      { error: '보유종목 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 보유종목 추가
export async function POST(request: NextRequest) {
  console.log('POST /api/portfolio/holdings called');
  
  try {
    const userId = getUserFromToken(request);
    console.log('User ID from token:', userId);
    
    if (!userId) {
      console.log('No user ID found, returning 401');
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    const { accountId, stockCode, stockName, quantity, averagePrice, currency = 'KRW' } = requestBody;

    if (!accountId || !stockCode || !stockName || !quantity || !averagePrice) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
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

    // 동일 계좌의 동일 종목 중복 확인
    const existingHolding = await prisma.holding.findFirst({
      where: {
        accountId: accountId,
        stockCode: stockCode,
      },
    });

    if (existingHolding) {
      // 기존 보유종목이 있으면 수량과 평균단가 업데이트
      const totalQuantity = existingHolding.quantity + quantity;
      const totalValue = (existingHolding.quantity * existingHolding.averagePrice) + (quantity * averagePrice);
      const newAveragePrice = totalValue / totalQuantity;

      const updatedHolding = await prisma.holding.update({
        where: { id: existingHolding.id },
        data: {
          quantity: totalQuantity,
          averagePrice: newAveragePrice,
        },
        include: {
          account: {
            include: {
              institution: true,
            },
          },
        },
      });

      return NextResponse.json({ holding: updatedHolding }, { status: 200 });
    } else {
      // 새 보유종목 생성
      const holding = await prisma.holding.create({
        data: {
          accountId: accountId,
          stockCode: stockCode,
          stockName: stockName,
          quantity: quantity,
          averagePrice: averagePrice,
          currency: currency,
        },
        include: {
          account: {
            include: {
              institution: true,
            },
          },
        },
      });

      return NextResponse.json({ holding }, { status: 201 });
    }
  } catch (error) {
    console.error('Failed to create holding:', error);
    return NextResponse.json(
      { error: '보유종목 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
