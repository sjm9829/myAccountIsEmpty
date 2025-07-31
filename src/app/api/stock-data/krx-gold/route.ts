import { NextResponse } from 'next/server';

// KRX 금현물 데이터 (모의 데이터 - 실제로는 한국거래소 API 또는 웹 스크래핑 필요)
export async function GET() {
  try {
    // 실제로는 한국거래소 API나 공식 데이터 소스를 사용해야 합니다.
    // 여기서는 모의 데이터를 생성합니다.
    const goldPrices = {
      'GOLD001': {
        code: 'GOLD001',
        name: '금현물 (1g)',
        market: 'KRX_GOLD' as const,
        currentPrice: 85000 + Math.random() * 2000 - 1000, // 85,000원 기준 ±1,000원 변동
        change: Math.random() * 2000 - 1000,
        changePercent: (Math.random() * 4 - 2), // ±2% 변동
        volume: Math.floor(Math.random() * 10000) + 1000,
        lastUpdate: new Date().toISOString(),
      },
      'SILVER001': {
        code: 'SILVER001',
        name: '은현물 (1g)',
        market: 'KRX_GOLD' as const,
        currentPrice: 1100 + Math.random() * 100 - 50, // 1,100원 기준 ±50원 변동
        change: Math.random() * 100 - 50,
        changePercent: (Math.random() * 6 - 3), // ±3% 변동
        volume: Math.floor(Math.random() * 50000) + 5000,
        lastUpdate: new Date().toISOString(),
      },
      'PLATINUM001': {
        code: 'PLATINUM001',
        name: '백금현물 (1g)',
        market: 'KRX_GOLD' as const,
        currentPrice: 45000 + Math.random() * 1000 - 500, // 45,000원 기준 ±500원 변동
        change: Math.random() * 1000 - 500,
        changePercent: (Math.random() * 3 - 1.5), // ±1.5% 변동
        volume: Math.floor(Math.random() * 2000) + 100,
        lastUpdate: new Date().toISOString(),
      },
    };

    // changePercent 계산 보정
    Object.values(goldPrices).forEach(item => {
      const previousPrice = item.currentPrice - item.change;
      item.changePercent = (item.change / previousPrice) * 100;
    });

    return NextResponse.json(goldPrices);
  } catch (error) {
    console.error('KRX Gold API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gold prices', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// 실제 KRX 금현물 데이터를 가져오는 함수 (구현 예시)
async function fetchRealKRXGoldData() {
  try {
    // 실제 구현시에는 다음과 같은 방법들을 사용할 수 있습니다:
    
    // 1. 한국거래소 공식 API (있다면)
    // const response = await fetch('https://api.krx.co.kr/gold/prices');
    
    // 2. 웹 스크래핑 (법적 문제 없는 공개 데이터만)
    // const response = await fetch('공개 금시세 사이트');
    
    // 3. 제3자 금융 데이터 제공업체 API
    // const response = await fetch('https://api.financial-data-provider.com/gold');
    
    // 4. Yahoo Finance의 금 ETF나 선물 데이터 활용
    // const response = await fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F');
    
    return null; // 실제 구현 필요
  } catch (error) {
    console.error('Failed to fetch real KRX gold data:', error);
    return null;
  }
}
