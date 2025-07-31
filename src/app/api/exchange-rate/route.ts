import { NextResponse } from 'next/server';

// 환율 정보를 가져오는 함수 (USD to KRW)
async function getExchangeRate(): Promise<number> {
  try {
    // 여러 환율 API를 시도
    const urls = [
      'https://api.exchangerate-api.com/v4/latest/USD',
      'https://open.er-api.com/v6/latest/USD'
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const krwRate = data.rates?.KRW;
          
          if (krwRate && krwRate > 0) {
            console.log(`Exchange rate USD to KRW: ${krwRate} from ${url}`);
            return krwRate;
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch exchange rate from ${url}:`, error);
        continue;
      }
    }

    // 모든 API 실패 시 기본 환율 사용 (대략적 값)
    console.warn('All exchange rate APIs failed, using fallback rate');
    return 1350; // 기본 환율 (대략적 값)
    
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    return 1350; // 기본 환율
  }
}

export async function GET() {
  try {
    const exchangeRate = await getExchangeRate();
    
    return NextResponse.json({ 
      success: true,
      data: {
        from: 'USD',
        to: 'KRW',
        rate: exchangeRate,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json(
      { error: '환율 정보를 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
