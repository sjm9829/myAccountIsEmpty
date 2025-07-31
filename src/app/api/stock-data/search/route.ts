import { NextRequest, NextResponse } from 'next/server';

// 주식 검색 데이터베이스 (실제로는 외부 API나 데이터베이스 사용)
const stockDatabase = [
  // 한국 주식
  { code: '005930', name: '삼성전자', market: 'KOSPI', sector: '반도체' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI', sector: '반도체' },
  { code: '035420', name: 'NAVER', market: 'KOSDAQ', sector: 'IT서비스' },
  { code: '051910', name: 'LG화학', market: 'KOSPI', sector: '화학' },
  { code: '006400', name: '삼성SDI', market: 'KOSPI', sector: '배터리' },
  { code: '035720', name: '카카오', market: 'KOSDAQ', sector: 'IT서비스' },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI', sector: '바이오' },
  { code: '068270', name: '셀트리온', market: 'KOSDAQ', sector: '바이오' },
  { code: '005380', name: '현대차', market: 'KOSPI', sector: '자동차' },
  { code: '012330', name: '현대모비스', market: 'KOSPI', sector: '자동차부품' },
  { code: '003550', name: 'LG', market: 'KOSPI', sector: '지주회사' },
  { code: '017670', name: 'SK텔레콤', market: 'KOSPI', sector: '통신서비스' },
  { code: '066570', name: 'LG전자', market: 'KOSPI', sector: '전자제품' },
  { code: '028260', name: '삼성물산', market: 'KOSPI', sector: '종합상사' },
  { code: '009150', name: '삼성전기', market: 'KOSPI', sector: '전자부품' },
  
  // 미국 주식
  { code: 'AAPL', name: 'Apple Inc.', market: 'NASDAQ', sector: 'Technology' },
  { code: 'MSFT', name: 'Microsoft Corporation', market: 'NASDAQ', sector: 'Technology' },
  { code: 'GOOGL', name: 'Alphabet Inc.', market: 'NASDAQ', sector: 'Technology' },
  { code: 'AMZN', name: 'Amazon.com Inc.', market: 'NASDAQ', sector: 'Consumer Discretionary' },
  { code: 'NVDA', name: 'NVIDIA Corporation', market: 'NASDAQ', sector: 'Technology' },
  { code: 'TSLA', name: 'Tesla Inc.', market: 'NASDAQ', sector: 'Consumer Discretionary' },
  { code: 'META', name: 'Meta Platforms Inc.', market: 'NASDAQ', sector: 'Technology' },
  { code: 'BRK-B', name: 'Berkshire Hathaway Inc.', market: 'NYSE', sector: 'Financial Services' },
  { code: 'V', name: 'Visa Inc.', market: 'NYSE', sector: 'Financial Services' },
  { code: 'JNJ', name: 'Johnson & Johnson', market: 'NYSE', sector: 'Healthcare' },
  { code: 'WMT', name: 'Walmart Inc.', market: 'NYSE', sector: 'Consumer Staples' },
  { code: 'JPM', name: 'JPMorgan Chase & Co.', market: 'NYSE', sector: 'Financial Services' },
  { code: 'PG', name: 'Procter & Gamble Co.', market: 'NYSE', sector: 'Consumer Staples' },
  { code: 'UNH', name: 'UnitedHealth Group Inc.', market: 'NYSE', sector: 'Healthcare' },
  { code: 'HD', name: 'Home Depot Inc.', market: 'NYSE', sector: 'Consumer Discretionary' },
  
  // 금현물
  { code: 'GOLD001', name: '금현물 (1g)', market: 'KRX_GOLD', sector: '귀금속' },
  { code: 'SILVER001', name: '은현물 (1g)', market: 'KRX_GOLD', sector: '귀금속' },
  { code: 'PLATINUM001', name: '백금현물 (1g)', market: 'KRX_GOLD', sector: '귀금속' },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase();
    
    if (!query) {
      return NextResponse.json({ results: [] });
    }

    // 검색 로직
    const results = stockDatabase.filter(stock => {
      return (
        stock.code.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query) ||
        stock.sector?.toLowerCase().includes(query)
      );
    }).slice(0, 20); // 최대 20개 결과

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Stock search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search stocks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
