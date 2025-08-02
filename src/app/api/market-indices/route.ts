import { NextResponse } from 'next/server';

// 주요 지수 데이터 타입
interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

// 실제 외부 API에서 데이터를 가져오는 함수
async function fetchMarketIndices(): Promise<MarketIndex[]> {
  const indices: MarketIndex[] = [];
  
  try {
    // 1. 주식 지수들 먼저 (KOSPI, NASDAQ, S&P500)
    
    // KOSPI 데이터
    try {
      const kospiResponse = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/^KS11',
        { 
          next: { revalidate: 300 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (kospiResponse.ok) {
        const kospiData = await kospiResponse.json();
        const result = kospiData.chart?.result?.[0];
        const meta = result?.meta;
        
        if (meta && meta.regularMarketPrice) {
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.previousClose || currentPrice;
          const change = currentPrice - previousClose;
          const changePercent = (change / previousClose) * 100;
          
          indices.push({
            name: 'KOSPI',
            value: Number(currentPrice.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2))
          });
        } else {
          throw new Error('KOSPI data format error');
        }
      } else {
        throw new Error('KOSPI API call failed');
      }
    } catch (error) {
      console.error('KOSPI API 오류:', error);
      indices.push({
        name: 'KOSPI',
        value: 2627.85,
        change: 22.15,
        changePercent: 0.85
      });
    }

    // NASDAQ 데이터
    try {
      const nasdaqResponse = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/^IXIC',
        { 
          next: { revalidate: 300 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (nasdaqResponse.ok) {
        const nasdaqData = await nasdaqResponse.json();
        const result = nasdaqData.chart?.result?.[0];
        const meta = result?.meta;
        
        if (meta && meta.regularMarketPrice) {
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.previousClose || currentPrice;
          const change = currentPrice - previousClose;
          const changePercent = (change / previousClose) * 100;
          
          indices.push({
            name: 'NASDAQ',
            value: Number(currentPrice.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2))
          });
        } else {
          throw new Error('NASDAQ data format error');
        }
      } else {
        throw new Error('NASDAQ API call failed');
      }
    } catch (error) {
      console.error('NASDAQ API 오류:', error);
      indices.push({
        name: 'NASDAQ',
        value: 17136.30,
        change: -106.85,
        changePercent: -0.62
      });
    }

    // S&P 500 데이터
    try {
      const spResponse = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/^GSPC',
        { 
          next: { revalidate: 300 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (spResponse.ok) {
        const spData = await spResponse.json();
        const result = spData.chart?.result?.[0];
        const meta = result?.meta;
        
        if (meta && meta.regularMarketPrice) {
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.previousClose || currentPrice;
          const change = currentPrice - previousClose;
          const changePercent = (change / previousClose) * 100;
          
          indices.push({
            name: 'S&P500',
            value: Number(currentPrice.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2))
          });
        } else {
          throw new Error('S&P500 data format error');
        }
      } else {
        throw new Error('S&P500 API call failed');
      }
    } catch (error) {
      console.error('S&P500 API 오류:', error);
      indices.push({
        name: 'S&P500',
        value: 5463.54,
        change: -23.55,
        changePercent: -0.43
      });
    }

    // 2. 환율 데이터 (USD/KRW, JPY(100)/KRW)
    try {
      const exchangeResponse = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { 
          next: { revalidate: 300 }, // 5분 캐시
          headers: {
            'User-Agent': 'myAccountIsEmpty/1.0'
          }
        }
      );
      
      if (exchangeResponse.ok) {
        const exchangeData = await exchangeResponse.json();
        const krwRate = exchangeData.rates.KRW;
        const jpyRate = exchangeData.rates.JPY;
        
        if (krwRate) {
          // 전날 대비 변동을 위한 간단한 계산
          const baseUsdKrw = 1377.20;
          const change = krwRate - baseUsdKrw;
          const changePercent = (change / baseUsdKrw) * 100;
          
          indices.push({
            name: 'USD/KRW',
            value: Number(krwRate.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2))
          });
        }
        
        if (jpyRate && krwRate) {
          // JPY(100)/KRW 계산
          const jpyToKrw = (krwRate / jpyRate) * 100;
          const baseJpyKrw = 948.50;
          const change = jpyToKrw - baseJpyKrw;
          const changePercent = (change / baseJpyKrw) * 100;
          
          indices.push({
            name: 'JPY(100)/KRW',
            value: Number(jpyToKrw.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2))
          });
        }
      } else {
        throw new Error('Exchange rate API call failed');
      }
    } catch (error) {
      console.error('환율 API 오류:', error);
      // 환율 API 실패 시 기본값
      indices.push(
        {
          name: 'USD/KRW',
          value: 1377.20,
          change: 3.80,
          changePercent: 0.28
        },
        {
          name: 'JPY(100)/KRW',
          value: 948.50,
          change: -2.30,
          changePercent: -0.24
        }
      );
    }

    return indices;
    
  } catch (error) {
    console.error('Market indices fetch error:', error);
    
    // 전체 API 호출 실패 시 기본 데이터 반환 (지수 먼저, 환율 나중)
    return [
      { name: 'KOSPI', value: 2627.85, change: 22.15, changePercent: 0.85 },
      { name: 'NASDAQ', value: 17136.30, change: -106.85, changePercent: -0.62 },
      { name: 'S&P500', value: 5463.54, change: -23.55, changePercent: -0.43 },
      { name: 'USD/KRW', value: 1377.20, change: 3.80, changePercent: 0.28 },
      { name: 'JPY(100)/KRW', value: 948.50, change: -2.30, changePercent: -0.24 }
    ];
  }
}

export async function GET() {
  try {
    const indices = await fetchMarketIndices();
    
    return NextResponse.json({
      success: true,
      data: indices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('주요 지수 데이터 조회 실패:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '주요 지수 데이터를 가져오는 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}
