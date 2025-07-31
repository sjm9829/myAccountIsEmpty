// 무료 주식 API 통합 서비스
export interface StockData {
  code: string;
  name: string;
  market: 'KRX_KOSPI' | 'KRX_KOSDAQ' | 'KRX_GOLD' | 'NASDAQ' | 'NYSE';
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  lastUpdate: string;
}

export interface StockSearchResult {
  code: string;
  name: string;
  market: string;
  sector?: string;
}

class StockAPIService {
  private readonly API_CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시
  private cache = new Map<string, { data: StockData; timestamp: number }>();

  // Yahoo Finance API를 통한 주식 데이터 조회 (비공식이지만 무료)
  async getStockData(codes: string[]): Promise<{ [key: string]: StockData }> {
    const result: { [key: string]: StockData } = {};
    
    for (const code of codes) {
      try {
        // 캐시 확인
        const cached = this.cache.get(code);
        if (cached && Date.now() - cached.timestamp < this.API_CACHE_DURATION) {
          result[code] = cached.data;
          continue;
        }

        // API 호출
        const stockData = await this.fetchStockFromYahoo(code);
        if (stockData) {
          result[code] = stockData;
          this.cache.set(code, { data: stockData, timestamp: Date.now() });
        }
      } catch (error) {
        console.error(`Failed to fetch stock data for ${code}:`, error);
        // 캐시된 데이터라도 사용
        const cached = this.cache.get(code);
        if (cached) {
          result[code] = cached.data;
        }
      }
    }

    return result;
  }

  // Yahoo Finance에서 개별 주식 데이터 가져오기
  private async fetchStockFromYahoo(code: string): Promise<StockData | null> {
    try {
      // 한국 주식의 경우 .KS 또는 .KQ 접미사 추가
      const yahooSymbol = this.convertToYahooSymbol(code);
      
      // Yahoo Finance API 호출 (비공식 엔드포인트)
      const response = await fetch(`/api/stock-data/yahoo?symbol=${yahooSymbol}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        code,
        name: data.longName || data.shortName || code,
        market: this.determineMarket(code),
        currentPrice: data.regularMarketPrice || 0,
        change: data.regularMarketChange || 0,
        changePercent: data.regularMarketChangePercent || 0,
        volume: data.regularMarketVolume || 0,
        marketCap: data.marketCap,
        high52w: data.fiftyTwoWeekHigh,
        low52w: data.fiftyTwoWeekLow,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error fetching Yahoo data for ${code}:`, error);
      return null;
    }
  }

  // Alpha Vantage API (일일 500회 무료)
  private async fetchStockFromAlphaVantage(code: string): Promise<StockData | null> {
    try {
      const apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY;
      if (!apiKey) {
        console.warn('Alpha Vantage API key not found');
        return null;
      }

      const response = await fetch(
        `/api/stock-data/alpha-vantage?symbol=${code}&apikey=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Alpha Vantage 응답 파싱
      const quote = data['Global Quote'];
      if (!quote) {
        throw new Error('Invalid Alpha Vantage response');
      }

      return {
        code,
        name: code, // Alpha Vantage는 회사명을 제공하지 않음
        market: this.determineMarket(code),
        currentPrice: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error fetching Alpha Vantage data for ${code}:`, error);
      return null;
    }
  }

  // KRX 금현물 데이터 (한국거래소 공개 데이터)
  async getGoldPrices(): Promise<{ [key: string]: StockData }> {
    try {
      const response = await fetch('/api/stock-data/krx-gold');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching KRX gold data:', error);
      return {};
    }
  }

  // 주식 검색
  async searchStocks(query: string): Promise<StockSearchResult[]> {
    try {
      const response = await fetch(`/api/stock-data/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching stocks:', error);
      return [];
    }
  }

  // 코드를 Yahoo Finance 심볼로 변환
  private convertToYahooSymbol(code: string): string {
    // 한국 주식
    if (/^\d{6}$/.test(code)) {
      // KOSPI는 .KS, KOSDAQ는 .KQ
      // 실제로는 더 정확한 구분이 필요하지만 간단히 처리
      if (this.isKOSDAQStock(code)) {
        return `${code}.KQ`;
      } else {
        return `${code}.KS`;
      }
    }
    
    // 미국 주식은 그대로
    return code;
  }

  // KOSDAQ 주식인지 판단 (간단한 로직)
  private isKOSDAQStock(code: string): boolean {
    // 실제로는 더 정확한 데이터베이스가 필요
    // 임시로 몇 개 코스닥 종목만 구분
    const kosdaqCodes = ['035420', '051910', '035720', '207940', '068270'];
    return kosdaqCodes.includes(code);
  }

  // 시장 구분
  private determineMarket(code: string): StockData['market'] {
    if (/^\d{6}$/.test(code)) {
      return this.isKOSDAQStock(code) ? 'KRX_KOSDAQ' : 'KRX_KOSPI';
    }
    
    // 금현물 코드 (예: GOLD001)
    if (code.startsWith('GOLD') || code.startsWith('SILVER')) {
      return 'KRX_GOLD';
    }
    
    // 미국 주식은 기본적으로 NASDAQ으로 분류 (실제로는 더 정확한 구분 필요)
    return 'NASDAQ';
  }

  // 인기 종목 목록
  getPopularStocks(): { kr: string[]; us: string[]; gold: string[] } {
    return {
      kr: [
        '005930', // 삼성전자
        '000660', // SK하이닉스
        '035420', // NAVER
        '051910', // LG화학
        '006400', // 삼성SDI
        '035720', // 카카오
        '207940', // 삼성바이오로직스
        '068270', // 셀트리온
        '005380', // 현대차
        '012330', // 현대모비스
      ],
      us: [
        'AAPL',   // Apple
        'MSFT',   // Microsoft
        'GOOGL',  // Alphabet
        'AMZN',   // Amazon
        'NVDA',   // NVIDIA
        'TSLA',   // Tesla
        'META',   // Meta
        'BRK-B',  // Berkshire Hathaway
        'V',      // Visa
        'JNJ',    // Johnson & Johnson
      ],
      gold: [
        'GOLD001', // 금현물
        'SILVER001', // 은현물
      ],
    };
  }
}

export const stockAPI = new StockAPIService();
