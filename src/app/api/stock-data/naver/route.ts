import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    // 금속 선물 종목 (M으로 시작하는 8자리) 처리
    if (/^M\d{8}$/.test(symbol)) {
      console.log(`Trying to fetch metal futures data for ${symbol} from Naver Mobile Page`);
      
      // 네이버 모바일 금시세 페이지에서 직접 데이터 가져오기 (구글 스프레드시트 방식)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const goldMobileResponse = await fetch(
          `https://m.stock.naver.com/marketindex/metals/${symbol}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
              'Referer': 'https://m.stock.naver.com/marketindex',
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        console.log(`Naver Mobile Gold Page response status: ${goldMobileResponse.status}`);

        if (goldMobileResponse.ok) {
          const htmlText = await goldMobileResponse.text();
          console.log('Naver Mobile Gold Page HTML length:', htmlText.length);
          
          // HTML에서 금시세 데이터 추출 (구글 스프레드시트와 동일한 방식)
          // 디버깅을 위해 HTML에서 금 관련 부분 찾기
          const goldDataMatch = htmlText.match(/국내\s*금[\s\S]{0,500}/);
          if (goldDataMatch) {
            console.log('Found gold data section:', goldDataMatch[0]);
          }
          
          // 원/g 패턴 주변 찾기
          const wonPerGramMatch = htmlText.match(/[\s\S]{0,200}원\/g[\s\S]{0,200}/);
          if (wonPerGramMatch) {
            console.log('Found 원/g section:', wonPerGramMatch[0]);
          }
          
          // 하락/상승 패턴 주변 찾기
          const changeTextMatch = htmlText.match(/[\s\S]{0,100}[하상][락승][\s\S]{0,100}/);
          if (changeTextMatch) {
            console.log('Found change section:', changeTextMatch[0]);
          }
          
          // 현재가 추출 - 실제 HTML 구조에 맞게 수정
          let currentPrice = 0;
          let change = 0;
          let changePercent = 0;
          
          // 패턴 1: HTML 클래스 기반 추출 <strong class="DetailInfo_price__I_VJn">147,560<span class="DetailInfo_type__8tk_X">원/g</span>
          let priceMatch = htmlText.match(/class="DetailInfo_price__I_VJn">(\d{1,3}(?:,\d{3})*)<span[^>]*>원\/g/);
          if (!priceMatch) {
            // 패턴 2: 일반적인 원/g 패턴
            priceMatch = htmlText.match(/>(\d{1,3}(?:,\d{3})*)<[^>]*원\/g/);
          }
          if (!priceMatch) {
            // 패턴 3: JSON 데이터에서 추출
            const jsonPriceMatch = htmlText.match(/"price":"(\d{1,3}(?:,\d{3})*)"/);
            if (jsonPriceMatch) {
              priceMatch = [jsonPriceMatch[0], jsonPriceMatch[1]];
            }
          }
          
          if (priceMatch) {
            currentPrice = parseFloat(priceMatch[1].replace(/,/g, '')) || 0;
            console.log('Found price match:', priceMatch[0], '-> parsed as:', currentPrice);
          } else {
            console.log('No price pattern matched');
          }
          
          // 변동 정보 추출 - JSON과 HTML 패턴 사용
          // 패턴 1: JSON 데이터에서 직접 추출
          const jsonDataMatch = htmlText.match(/"fluctuations":"([+-]?\d{1,3}(?:,\d{3})*)","fluctuationsRatio":"([+-]?\d+(?:\.\d+)?)"/);
          if (jsonDataMatch) {
            change = parseFloat(jsonDataMatch[1].replace(/,/g, '')) || 0;
            changePercent = parseFloat(jsonDataMatch[2]) || 0;
            console.log('Found JSON change data:', jsonDataMatch[0], '-> change:', change, 'changePercent:', changePercent);
          } else {
            // 패턴 2: HTML에서 변동 정보 추출
            // 하락/상승 키워드와 함께 추출
            const fluctuationMatch = htmlText.match(/Fluctuation_fluctuation__9UU9_[^>]*>[\s\S]*?(\d{1,3}(?:,\d{3})*)<[\s\S]*?([+-]?\d+(?:\.\d+)?)<span[^>]*>%/);
            if (fluctuationMatch) {
              const changeAmount = parseFloat(fluctuationMatch[1].replace(/,/g, '')) || 0;
              changePercent = parseFloat(fluctuationMatch[2]) || 0;
              
              // FALLING/RISING 클래스로 방향 판단
              if (htmlText.includes('Fluctuation_FALLING')) {
                change = -Math.abs(changeAmount);
                changePercent = -Math.abs(changePercent);
              } else if (htmlText.includes('Fluctuation_RISING')) {
                change = Math.abs(changeAmount);
                changePercent = Math.abs(changePercent);
              }
              console.log('Found HTML change data:', fluctuationMatch[0], '-> change:', change, 'changePercent:', changePercent);
            } else {
              console.log('No change pattern matched, trying fallback...');
              // 기존 폴백 로직 유지
              if (htmlText.includes('하락')) {
                const fallMatch = htmlText.match(/하락[^>]*>[\s\S]*?(\d{1,3}(?:,\d{3})*)/);
                if (fallMatch) {
                  change = -parseFloat(fallMatch[1].replace(/,/g, ''));
                  console.log('Found fallback change amount:', change);
                }
                const fallPercentMatch = htmlText.match(/([+-]?\d+(?:\.\d+)?)%/);
                if (fallPercentMatch) {
                  changePercent = -Math.abs(parseFloat(fallPercentMatch[1]));
                  console.log('Found fallback change percent:', changePercent);
                }
              } else if (htmlText.includes('상승')) {
                const riseMatch = htmlText.match(/상승[^>]*>[\s\S]*?(\d{1,3}(?:,\d{3})*)/);
                if (riseMatch) {
                  change = parseFloat(riseMatch[1].replace(/,/g, ''));
                  console.log('Found fallback change amount:', change);
                }
                const risePercentMatch = htmlText.match(/([+-]?\d+(?:\.\d+)?)%/);
                if (risePercentMatch) {
                  changePercent = Math.abs(parseFloat(risePercentMatch[1]));
                  console.log('Found fallback change percent:', changePercent);
                }
              }
              console.log('Used fallback parsing - change:', change, 'changePercent:', changePercent);
            }
          }
          
          // 업데이트 시간 추출 (예: 07.31. 15:19)
          const timeMatch = htmlText.match(/(\d{2})\.(\d{2})\.\s+(\d{2}):(\d{2})/);
          let lastUpdate = new Date().toISOString();
          if (timeMatch) {
            const [, month, day, hour, minute] = timeMatch;
            const currentYear = new Date().getFullYear();
            lastUpdate = new Date(`${currentYear}-${month}-${day}T${hour}:${minute}:00+09:00`).toISOString();
          }

          if (currentPrice > 0) {
            console.log(`Successfully extracted gold price: ${currentPrice}, change: ${change}, changePercent: ${changePercent}`);
            return NextResponse.json({
              symbol,
              longName: '국내 금 99.99% 1Kg',
              shortName: '금 99.99% 1Kg',
              regularMarketPrice: currentPrice,
              regularMarketChange: change,
              regularMarketChangePercent: changePercent,
              regularMarketVolume: 0, // 네이버 모바일 페이지에는 거래량 정보 없음
              currency: 'KRW',
              exchangeName: 'KRX',
              lastUpdate: lastUpdate,
              source: 'naver-mobile-gold'
            });
          }
        }
      } catch (goldMobileError) {
        console.warn('Naver Mobile Gold Page scraping failed:', goldMobileError);
      }

      // 모바일 페이지 스크래핑 실패 시 모의 데이터 (0으로 설정)
      console.log('Mobile gold page scraping failed, providing mock data with zero values for', symbol);
      
      return NextResponse.json({
        symbol,
        longName: '국내 금 99.99% 1Kg',
        shortName: '금 99.99% 1Kg',
        regularMarketPrice: 0,
        regularMarketChange: 0,
        regularMarketChangePercent: 0,
        regularMarketVolume: 0,
        currency: 'KRW',
        exchangeName: 'KRX',
        lastUpdate: new Date().toISOString(),
        source: 'mock-data-zero'
      });
    }

    // 일반 주식 처리
    // 네이버 금융 API 시도 (일반 주식)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const naverResponse = await fetch(
        `https://polling.finance.naver.com/api/realtime/domestic/stock/${symbol}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://finance.naver.com/',
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);

      if (naverResponse.ok) {
        const naverData = await naverResponse.json();
        console.log('Naver stock API response:', naverData);
        
        if (naverData && naverData.datas && naverData.datas.length > 0) {
          const stockData = naverData.datas[0];
          
          const currentPrice = parseFloat(stockData.closePrice?.replace(/,/g, '')) || 0;
          const change = parseFloat(stockData.compareToPreviousClosePrice?.replace(/,/g, '')) || 0;
          const changePercent = parseFloat(stockData.fluctuationsRatio) || 0;

          return NextResponse.json({
            symbol,
            longName: stockData.stockName || symbol,
            shortName: stockData.stockName || symbol,
            regularMarketPrice: currentPrice,
            regularMarketChange: change,
            regularMarketChangePercent: changePercent,
            regularMarketVolume: parseInt(stockData.accumulatedTradingVolume?.replace(/,/g, '')) || 0,
            currency: 'KRW',
            exchangeName: 'KRX',
            lastUpdate: new Date().toISOString(),
            source: 'naver-stock'
          });
        }
      }
    } catch (stockError) {
      console.warn('Naver stock API failed:', stockError);
    }

    // ETF 데이터 시도
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const etfResponse = await fetch(
        `https://polling.finance.naver.com/api/realtime/domestic/etf/${symbol}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://finance.naver.com/',
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);

      if (etfResponse.ok) {
        const etfData = await etfResponse.json();
        console.log('Naver ETF API response:', etfData);
        
        if (etfData && etfData.datas && etfData.datas.length > 0) {
          const stockData = etfData.datas[0];
          
          const currentPrice = parseFloat(stockData.closePrice?.replace(/,/g, '')) || 0;
          const change = parseFloat(stockData.compareToPreviousClosePrice?.replace(/,/g, '')) || 0;
          const changePercent = parseFloat(stockData.fluctuationsRatio) || 0;

          return NextResponse.json({
            symbol,
            longName: stockData.stockName || symbol,
            shortName: stockData.stockName || symbol,
            regularMarketPrice: currentPrice,
            regularMarketChange: change,
            regularMarketChangePercent: changePercent,
            regularMarketVolume: parseInt(stockData.accumulatedTradingVolume?.replace(/,/g, '')) || 0,
            currency: 'KRW',
            exchangeName: 'KRX',
            lastUpdate: new Date().toISOString(),
            source: 'naver-etf'
          });
        }
      }
    } catch (etfError) {
      console.warn('Naver ETF API failed:', etfError);
    }

    // 선물 데이터 시도
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const futuresResponse = await fetch(
        `https://polling.finance.naver.com/api/realtime/domestic/futures/${symbol}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://finance.naver.com/',
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);

      if (futuresResponse.ok) {
        const futuresData = await futuresResponse.json();
        console.log('Naver futures API response:', futuresData);
        
        if (futuresData && futuresData.datas && futuresData.datas.length > 0) {
          const stockData = futuresData.datas[0];
          
          const currentPrice = parseFloat(stockData.closePrice?.replace(/,/g, '')) || 0;
          const change = parseFloat(stockData.compareToPreviousClosePrice?.replace(/,/g, '')) || 0;
          const changePercent = parseFloat(stockData.fluctuationsRatio) || 0;

          return NextResponse.json({
            symbol,
            longName: stockData.stockName || symbol,
            shortName: stockData.stockName || symbol,
            regularMarketPrice: currentPrice,
            regularMarketChange: change,
            regularMarketChangePercent: changePercent,
            regularMarketVolume: parseInt(stockData.accumulatedTradingVolume?.replace(/,/g, '')) || 0,
            currency: 'KRW',
            exchangeName: 'KRX',
            lastUpdate: new Date().toISOString(),
            source: 'naver-futures'
          });
        }
      }
    } catch (futuresError) {
      console.warn('Naver futures API failed:', futuresError);
    }

    console.log('All Naver APIs failed for symbol:', symbol);
    return NextResponse.json({ 
      error: `No data available for symbol: ${symbol}`,
      source: 'naver-all-failed'
    }, { status: 404 });

  } catch (error) {
    console.error('Naver API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      source: 'naver-server-error'
    }, { status: 500 });
  }
}
