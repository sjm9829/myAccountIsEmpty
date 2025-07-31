import { NextRequest, NextResponse } from 'next/server';
import { isAfterMarketClose, getPreviousTradingDay } from '@/utils/dateUtils';

// 한국 종목 코드를 Yahoo Finance 형식으로 변환
function formatKoreanSymbol(symbol: string): string {
  // 이미 .KS 또는 .KQ가 붙어있으면 그대로 반환
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) {
    return symbol;
  }
  
  // 숫자로만 구성된 6자리 한국 종목코드 확인
  if (/^\d{6}$/.test(symbol)) {
    // KOSDAQ 종목들 (주요 KOSDAQ 종목들)
    const kosdaqCodes = [
      '043150', '065420', '068270', '078130', '086520', '101490', '137310', '141080',
      '145020', '161390', '183490', '196170', '200130', '214420', '225570', '240810',
      '247540', '263750', '293490', '317870', '348210', '357780', '365340', '376300',
      '393890', '403870', '950140', '950210'
    ];
    
    return kosdaqCodes.includes(symbol) ? `${symbol}.KQ` : `${symbol}.KS`;
  }
  
  // 이미 적절한 형식이면 그대로 반환
  return symbol;
}

// 여러 Yahoo Finance 엔드포인트 시도
async function fetchYahooData(symbol: string) {
  // 미국 주식인지 확인 (영문자로만 구성)
  const isUSStock = /^[A-Z]{1,5}$/.test(symbol);
  
  // 미국 주식이면 그대로 사용, 한국 주식이면 포맷팅
  const formattedSymbol = isUSStock ? symbol : formatKoreanSymbol(symbol);
  
  console.log(`Fetching Yahoo data for: ${symbol} -> ${formattedSymbol} (isUSStock: ${isUSStock})`);
  
  // 여러 엔드포인트를 시도해볼 URL들
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}?interval=1d&range=1d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${formattedSymbol}?interval=1d&range=1d`,
  ];
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
    'Referer': 'https://finance.yahoo.com/',
  };
  
  for (const url of urls) {
    try {
      console.log(`Trying Yahoo Finance URL: ${url}`);
      const response = await fetch(url, { headers });
      
      console.log(`Yahoo Finance response status: ${response.status} for ${url}`);
      
      if (response.ok) {
        return { response, formattedSymbol };
      } else {
        console.warn(`Yahoo Finance responded with status ${response.status} for ${url}`);
        const errorText = await response.text();
        console.warn(`Error response body: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${url}:`, error);
      continue;
    }
  }
  
  throw new Error(`Unable to fetch data for symbol: ${symbol} (tried: ${formattedSymbol}). All Yahoo Finance endpoints returned errors.`);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    console.log(`Yahoo Finance API called for symbol: ${symbol}`);

    // Yahoo Finance 데이터 가져오기
    let yahooResponse, formattedSymbol;
    try {
      const result = await fetchYahooData(symbol);
      yahooResponse = result.response;
      formattedSymbol = result.formattedSymbol;
    } catch (error) {
      console.error(`Failed to fetch Yahoo data for ${symbol}:`, error);
      return NextResponse.json({ 
        error: `Symbol not found: ${symbol}. This symbol may not be available on Yahoo Finance.`,
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 404 });
    }

    const yahooData = await yahooResponse.json();
    console.log(`Yahoo Finance raw data for ${symbol}:`, JSON.stringify(yahooData, null, 2));
    
    // 추가로 상세 정보 가져오기
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${formattedSymbol}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
          'Referer': 'https://finance.yahoo.com/',
        }
      }
    );

    let quoteData = null;
    if (quoteResponse.ok) {
      try {
        const quote = await quoteResponse.json();
        quoteData = quote.quoteResponse?.result?.[0];
      } catch (e) {
        console.warn('Failed to parse quote data:', e);
      }
    }

    // 차트 데이터에서 현재 가격 정보 추출
    const result = yahooData.chart?.result?.[0];
    if (!result) {
      throw new Error(`No chart data found for symbol: ${symbol} (${formattedSymbol})`);
    }

    const meta = result.meta;
    
    // 차트 데이터에서 시가 정보 추출 (당일 첫 거래 가격)
    let todayOpen = null;
    if (result.indicators?.quote?.[0]?.open?.length > 0) {
      const openPrices = result.indicators.quote[0].open;
      // 마지막(최신) 시가 데이터
      todayOpen = openPrices[openPrices.length - 1];
    }
    
    // 장 종료 후인지 확인하고 이전 영업일 데이터 가져오기
    const afterMarketClose = isAfterMarketClose(symbol);
    let previousTradingDayData = null;
    
    console.log(`🏢 Market status for ${symbol}:`, {
      afterMarketClose,
      currentTime: new Date().toISOString()
    });
    
    if (afterMarketClose) {
      try {
        // 이전 영업일 계산
        const previousTradingDay = getPreviousTradingDay(symbol);
        const previousDayStart = Math.floor(previousTradingDay.getTime() / 1000);
        const previousDayEnd = previousDayStart + 24 * 60 * 60; // 하루 추가
        
        console.log(`📅 Fetching previous trading day data for ${symbol}:`, {
          previousTradingDay: previousTradingDay.toISOString().split('T')[0],
          previousDayStart,
          previousDayEnd,
          afterMarketClose
        });
        
        // 이전 영업일 차트 데이터 가져오기
        const prevDayUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}?period1=${previousDayStart}&period2=${previousDayEnd}&interval=1d`;
        console.log(`🔗 Previous day URL: ${prevDayUrl}`);
        
        const prevDayResponse = await fetch(prevDayUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
            'Referer': 'https://finance.yahoo.com/',
          }
        });
        
        console.log(`📊 Previous day response status: ${prevDayResponse.status}`);
        
        if (prevDayResponse.ok) {
          const prevDayData = await prevDayResponse.json();
          console.log(`📈 Previous day raw data for ${symbol}:`, JSON.stringify(prevDayData, null, 2));
          
          const prevResult = prevDayData.chart?.result?.[0];
          if (prevResult) {
            // indicators.quote[0].close 배열에서 이전 영업일의 실제 종가 가져오기
            const closeArray = prevResult.indicators?.quote?.[0]?.close;
            let previousDayClose = null;
            
            if (closeArray && closeArray.length > 0) {
              // 배열의 첫 번째 값이 실제 이전 영업일 종가
              previousDayClose = closeArray[0];
              console.log(`📊 Close array for ${symbol}:`, closeArray, `Using first value: ${previousDayClose}`);
            } else if (prevResult.meta) {
              // 폴백: meta에서 chartPreviousClose 사용
              previousDayClose = prevResult.meta.chartPreviousClose || prevResult.meta.previousClose;
              console.log(`📊 Using meta fallback for ${symbol}: ${previousDayClose}`);
            }
            
            if (previousDayClose && previousDayClose > 0) {
              previousTradingDayData = {
                close: previousDayClose,
                date: previousTradingDay.toISOString().split('T')[0]
              };
              
              console.log(`✅ Previous trading day data for ${symbol}:`, previousTradingDayData);
            } else {
              console.warn(`⚠️ No valid previous day close found for ${symbol}`);
            }
          } else {
            console.warn(`⚠️ No result data in previous day response for ${symbol}`);
          }
        } else {
          console.warn(`❌ Failed to fetch previous day data: ${prevDayResponse.status} ${prevDayResponse.statusText}`);
        }
      } catch (error) {
        console.error(`💥 Error fetching previous trading day data for ${symbol}:`, error);
      }
    } else {
      console.log(`⏰ Market is open for ${symbol}, skipping previous trading day fetch`);
    }
    
    // 더 정확한 가격 정보 추출
    let currentPrice = 0;
    let previousClose = 0;
    let change = 0;
    let changePercent = 0;
    
    // quoteData에서 더 정확한 정보 가져오기
    if (quoteData) {
      // 1. 현재가 결정 (우선순위: regularMarketPrice > postMarketPrice > regularMarketPreviousClose)
      currentPrice = quoteData.regularMarketPrice || 
                    quoteData.postMarketPrice || 
                    quoteData.preMarketPrice ||
                    meta.regularMarketPrice || 
                    meta.previousClose || 0;
      
      // 2. 전일 종가 (장 종료 후에는 이전 영업일 데이터 우선 사용)
      if (afterMarketClose && previousTradingDayData) {
        previousClose = previousTradingDayData.close;
        console.log(`Using previous trading day close for ${symbol}:`, {
          previousTradingDayClose: previousClose,
          date: previousTradingDayData.date
        });
      } else {
        previousClose = quoteData.regularMarketPreviousClose || 
                       meta.chartPreviousClose || 
                       meta.previousClose || 0;
      }
      
      // 3. 당일 등락 계산 (현재가 vs 전일종가)
      if (previousClose > 0) {
        change = currentPrice - previousClose;
        changePercent = (change / previousClose) * 100;
      }
      
      console.log(`Price calculation for ${symbol}:`, {
        currentPrice,
        previousClose,
        change,
        changePercent,
        afterMarketClose,
        usedPreviousTradingDay: afterMarketClose && previousTradingDayData ? true : false,
        regularMarketPrice: quoteData.regularMarketPrice,
        postMarketPrice: quoteData.postMarketPrice,
        regularMarketPreviousClose: quoteData.regularMarketPreviousClose
      });
    } else {
      // quoteData가 없는 경우 기존 로직 사용
      currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
      
      // 장 종료 후에는 이전 영업일 데이터 사용
      if (afterMarketClose && previousTradingDayData) {
        previousClose = previousTradingDayData.close;
      } else {
        previousClose = meta.previousClose || currentPrice;
      }
      
      change = currentPrice - previousClose;
      changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
    }

    // 응답 데이터 구성
    const responseData = {
      symbol: symbol, // 원본 심볼 반환
      formattedSymbol: formattedSymbol, // Yahoo Finance에서 사용한 심볼
      longName: quoteData?.longName || quoteData?.shortName || meta.displayName || symbol,
      shortName: quoteData?.shortName || meta.displayName || symbol,
      regularMarketPrice: currentPrice,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      previousClose: previousClose, // 실제 전일 종가 (장 종료 후엔 이전 영업일 기준)
      regularMarketPreviousClose: quoteData?.regularMarketPreviousClose, // Yahoo Finance 전일 종가
      postMarketPrice: quoteData?.postMarketPrice, // 시간외 거래가
      regularMarketOpen: quoteData?.regularMarketOpen || todayOpen || meta.regularMarketOpen, // 당일 시가
      regularMarketDayHigh: quoteData?.regularMarketDayHigh || meta.regularMarketDayHigh, // 당일 고가
      regularMarketDayLow: quoteData?.regularMarketDayLow || meta.regularMarketDayLow, // 당일 저가
      regularMarketVolume: quoteData?.regularMarketVolume || meta.regularMarketVolume || 0,
      marketCap: quoteData?.marketCap,
      fiftyTwoWeekHigh: quoteData?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quoteData?.fiftyTwoWeekLow,
      currency: meta.currency || 'KRW',
      exchangeName: meta.exchangeName || 'KRX',
      lastUpdate: new Date().toISOString(),
      // 장 종료 후 추가 정보
      afterMarketClose,
      previousTradingDayData: afterMarketClose ? previousTradingDayData : undefined,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Yahoo Finance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
