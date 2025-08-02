import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 실제 주가 데이터를 가져오는 함수 (holdings API와 동일)
async function getCurrentPrice(stockCode: string, currency: string = 'KRW'): Promise<number> {
  try {
    // 한국 주식인지 확인 (6자리 숫자)
    const isKoreanStock = /^\d{6}$/.test(stockCode);
    // M0으로 시작하는 금속 선물인지 확인 (야후에서 지원하지 않음)
    const isMetalFutures = /^M0\d{7}$/.test(stockCode);
    // 미국 주식인지 확인 (영문자)
    const isUSStock = /^[A-Z]{1,5}$/.test(stockCode) && currency === 'USD';
    
    console.log(`getCurrentPrice for: ${stockCode}, currency: ${currency}, isKoreanStock: ${isKoreanStock}, isMetalFutures: ${isMetalFutures}, isUSStock: ${isUSStock}`);
    
    // 현재 요청的 base URL을 사용하여 API 호출
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    if (isUSStock) {
      // 미국 주식은 Yahoo Finance API 사용
      try {
        console.log(`Fetching US stock data for: ${stockCode}`);
        const response = await fetch(`${baseUrl}/api/stock-data/yahoo?symbol=${stockCode}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Yahoo API response for ${stockCode}:`, data);
          
          if (data.regularMarketPrice && data.regularMarketPrice > 0) {
            console.log(`Using Yahoo price for ${stockCode}: ${data.regularMarketPrice}`);
            return data.regularMarketPrice;
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
          return data.regularMarketPrice || 0;
        }
      } else {
        console.log(`Skipping Yahoo Finance for metal futures in summary API: ${stockCode}`);
        // 금속 선물은 네이버 API를 먼저 시도
        try {
          const response = await fetch(`${baseUrl}/api/stock-data/naver?symbol=${stockCode}`);
          if (response.ok) {
            const data = await response.json();
            return data.regularMarketPrice || 0;
          }
        } catch (error) {
          console.warn(`Naver API failed for ${stockCode} in summary:`, error);
        }
      }
    } else {
      // 해외 주식의 경우 Yahoo Finance API 사용
      const response = await fetch(`${baseUrl}/api/stock-data/yahoo?symbol=${stockCode}`);
      if (response.ok) {
        const data = await response.json();
        return data.regularMarketPrice || 0;
      }
    }
  } catch (error) {
    console.error(`Failed to fetch price for ${stockCode}:`, error);
  }
  
  // API 호출 실패 시 기본값 반환
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = payload.userId;

    // 사용자의 모든 계좌에서 보유 종목 조회
    const holdings = await prisma.holding.findMany({
      where: {
        account: {
          userId: userId
        }
      },
      include: {
        account: true
      }
    });

    // 환율 정보 가져오기
    let exchangeRate = 1350; // 기본값
    try {
      const exchangeResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/exchange-rate`);
      if (exchangeResponse.ok) {
        const exchangeData = await exchangeResponse.json();
        exchangeRate = exchangeData.data.rate;
        console.log(`Using exchange rate: ${exchangeRate}`);
      }
    } catch (error) {
      console.warn('Failed to fetch exchange rate, using default:', error);
    }

    // 포트폴리오 요약 계산
    let totalValue = 0;
    let totalCost = 0;
    let yesterdayTotalValue = 0; // 전일 총 자산 (당일 변동 계산용)

    // 실제 API에서 현재가를 가져와야 하지만, 임시로 더미 데이터 사용
    // TODO: 실제 주식 API 연동 필요
    for (const holding of holdings) {
      // 실제 현재가 가져오기
      const currentPrice = await getCurrentPrice(holding.stockCode, holding.currency || 'KRW');
      const currency = holding.currency || 'KRW';
      
      // 통화별로 계산 후 원화로 환산
      const holdingCurrentValue = currentPrice * holding.quantity;
      const holdingCost = holding.averagePrice * holding.quantity;
      
      // 원화로 환산
      const holdingCurrentValueKRW = currency === 'USD' ? holdingCurrentValue * exchangeRate : holdingCurrentValue;
      const holdingCostKRW = currency === 'USD' ? holdingCost * exchangeRate : holdingCost;
      
      totalValue += holdingCurrentValueKRW;
      totalCost += holdingCostKRW;
      
      // 전일 종가 계산 (현재가 기준으로 임시 계산 - 실제로는 전일 종가 API 필요)
      const yesterdayPrice = currentPrice * (1 - (Math.random() - 0.5) * 0.02); // ±1% 랜덤 (임시)
      const yesterdayHoldingValue = yesterdayPrice * holding.quantity;
      const yesterdayHoldingValueKRW = currency === 'USD' ? yesterdayHoldingValue * exchangeRate : yesterdayHoldingValue;
      yesterdayTotalValue += yesterdayHoldingValueKRW;
    }

    // 당일 변동액 계산 (실제 데이터 기반)
    const todayChange = totalValue - yesterdayTotalValue;

    const todayChangePercent = totalValue > 0 ? (todayChange / totalValue) * 100 : 0;
    const totalProfit = totalValue - totalCost;
    const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    const summary = {
      totalValue: Math.round(totalValue),
      todayChange: Math.round(todayChange),
      todayChangePercent: Number(todayChangePercent.toFixed(2)),
      totalProfit: Math.round(totalProfit),
      totalProfitPercent: Number(totalProfitPercent.toFixed(2))
    };

    return NextResponse.json(summary);

  } catch (error) {
    console.error('Portfolio summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
