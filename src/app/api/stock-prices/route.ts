import { NextRequest, NextResponse } from 'next/server';

// 모의 주가 데이터 (실제 환경에서는 외부 API를 사용)
const MOCK_STOCK_PRICES: { [key: string]: number } = {
  '005930': 75000,  // 삼성전자
  '000660': 135000, // SK하이닉스
  '035420': 280000, // NAVER
  '051910': 95000,  // LG화학
  '006400': 42000,  // 삼성SDI
  '035720': 52000,  // 카카오
  '207940': 45000,  // 삼성바이오로직스
  '068270': 85000,  // 셀트리온
  '005380': 89000,  // 현대차
  '012330': 290000, // 현대모비스
};

// 변동성을 위한 랜덤 가격 생성
function generateRandomPrice(basePrice: number, volatility: number = 0.05): number {
  const change = (Math.random() - 0.5) * 2 * volatility;
  return Math.round(basePrice * (1 + change));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codes = searchParams.get('codes')?.split(',') || [];

    if (codes.length === 0) {
      return NextResponse.json(
        { error: '종목 코드가 필요합니다.' },
        { status: 400 }
      );
    }

    const prices: { [key: string]: { 
      code: string;
      name: string;
      currentPrice: number;
      change: number;
      changePercent: number;
      volume: number;
      marketCap: number;
      high52w: number;
      low52w: number;
    } } = {};

    // 종목명 매핑
    const stockNames: { [key: string]: string } = {
      '005930': '삼성전자',
      '000660': 'SK하이닉스',
      '035420': 'NAVER',
      '051910': 'LG화학',
      '006400': '삼성SDI',
      '035720': '카카오',
      '207940': '삼성바이오로직스',
      '068270': '셀트리온',
      '005380': '현대차',
      '012330': '현대모비스',
    };

    codes.forEach(code => {
      const basePrice = MOCK_STOCK_PRICES[code];
      if (basePrice) {
        const currentPrice = generateRandomPrice(basePrice);
        const change = currentPrice - basePrice;
        const changePercent = (change / basePrice) * 100;
        
        prices[code] = {
          code,
          name: stockNames[code] || `종목${code}`,
          currentPrice,
          change,
          changePercent,
          volume: Math.floor(Math.random() * 1000000) + 100000,
          marketCap: Math.floor(currentPrice * Math.random() * 1000000000),
          high52w: Math.floor(currentPrice * 1.3),
          low52w: Math.floor(currentPrice * 0.7),
        };
      }
    });

    return NextResponse.json({ 
      prices,
      timestamp: new Date().toISOString(),
      success: true 
    });

  } catch (error) {
    console.error('주가 조회 오류:', error);
    return NextResponse.json(
      { error: '주가 정보를 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 실시간 주가 업데이트를 위한 POST 엔드포인트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'update_prices') {
      // 모든 주가를 약간씩 변동시킴
      Object.keys(MOCK_STOCK_PRICES).forEach(code => {
        MOCK_STOCK_PRICES[code] = generateRandomPrice(MOCK_STOCK_PRICES[code], 0.02);
      });

      return NextResponse.json({ 
        message: '주가가 업데이트되었습니다.',
        timestamp: new Date().toISOString(),
        success: true 
      });
    }

    return NextResponse.json(
      { error: '올바르지 않은 액션입니다.' },
      { status: 400 }
    );

  } catch (error) {
    console.error('주가 업데이트 오류:', error);
    return NextResponse.json(
      { error: '주가 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}
