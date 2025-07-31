import { NextRequest, NextResponse } from 'next/server';

// 한국 주식 데이터를 위한 대체 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    // 6자리 숫자가 아닌 경우 에러 반환
    if (!/^\d{6}$/.test(symbol)) {
      return NextResponse.json({ 
        error: 'Korean stock codes must be 6 digits' 
      }, { status: 400 });
    }

    try {
      // 네이버 금융 API 시도 (비공식)
      const naverResponse = await fetch(
        `https://polling.finance.naver.com/api/realtime/domestic/stock/${symbol}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://finance.naver.com/',
          }
        }
      );

      if (naverResponse.ok) {
        const naverData = await naverResponse.json();
        if (naverData.datas && naverData.datas.length > 0) {
          const stockData = naverData.datas[0];
          
          // 쉼표 제거 후 숫자 파싱
          const currentPrice = parseFloat(stockData.closePrice.replace(/,/g, '')) || 0;
          const change = parseFloat(stockData.compareToPreviousClosePrice.replace(/,/g, '')) || 0;
          const changePercent = parseFloat(stockData.fluctuationsRatio) || 0;
          const volume = parseInt(stockData.accumulatedTradingVolume.replace(/,/g, '')) || 0;

          return NextResponse.json({
            symbol,
            longName: stockData.stockName || symbol,
            shortName: stockData.stockName || symbol,
            regularMarketPrice: currentPrice,
            regularMarketChange: change,
            regularMarketChangePercent: changePercent,
            regularMarketVolume: volume,
            currency: 'KRW',
            exchangeName: 'KRX',
            lastUpdate: new Date().toISOString(),
            source: 'naver'
          });
        }
      }
    } catch (naverError) {
      console.warn('Naver API failed:', naverError);
    }

    // 모의 데이터 생성 (개발용)
    console.warn(`Unable to fetch real data for ${symbol}, returning mock data`);
    
    // 종목명 매핑 (주요 종목들)
    const stockNames: Record<string, string> = {
      '005930': '삼성전자',
      '000660': 'SK하이닉스',
      '035420': 'NAVER',
      '005490': 'POSCO홀딩스',
      '051910': 'LG화학',
      '035720': '카카오',
      '006400': '삼성SDI',
      '028260': '삼성물산',
      '207940': '삼성바이오로직스',
      '068270': '셀트리온',
      '323410': '카카오뱅크',
      '003670': 'POSCO DX',
      '096770': 'SK이노베이션',
      '017670': 'SK텔레콤',
      '259960': '크래프톤',
      '018260': '삼성에스디에스',
      '066570': 'LG전자',
      '015760': '한국전력',
      '003550': 'LG',
      '033780': 'KT&G',
      '476800': '신라젠',
      'M04020000': '금 99.99_1Kg' // 금 선물 종목 추가
    };

    // 기본 가격 범위 (실제로는 각 종목별로 다름)
    const basePrice = Math.floor(Math.random() * 100000) + 10000;
    const change = (Math.random() - 0.5) * basePrice * 0.1;
    const changePercent = (change / basePrice) * 100;
    
    return NextResponse.json({
      symbol,
      longName: stockNames[symbol] || `Stock ${symbol}`,
      shortName: stockNames[symbol] || `Stock ${symbol}`,
      regularMarketPrice: basePrice + change,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      regularMarketVolume: Math.floor(Math.random() * 1000000),
      currency: 'KRW',
      exchangeName: 'KRX',
      lastUpdate: new Date().toISOString(),
      source: 'mock',
      warning: 'This is mock data for development purposes'
    });

  } catch (error) {
    console.error('Korean stock API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Korean stock data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
