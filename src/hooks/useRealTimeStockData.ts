'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface StockData {
  symbol: string;
  longName: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  previousClose?: number; // 전일 종가 (장 종료 후엔 이전 영업일 기준)
  regularMarketPreviousClose?: number; // Yahoo Finance의 실제 전일 종가
  postMarketPrice?: number; // 시간외 거래가
  regularMarketOpen?: number; // 당일 시가
  regularMarketDayHigh?: number; // 당일 최고가
  regularMarketDayLow?: number; // 당일 최저가
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currency: string;
  exchangeName: string;
  lastUpdate: string;
  afterMarketClose?: boolean; // 장 종료 후 여부
  previousTradingDayData?: { // 이전 영업일 데이터
    close: number;
    date: string;
  };
}

interface UseRealTimeStockDataOptions {
  symbols: string[];
  intervalMs?: number; // 업데이트 간격 (기본값: 3분)
  enabled?: boolean; // 자동 업데이트 활성화 여부
}

interface UseRealTimeStockDataResult {
  stockData: Record<string, StockData>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refreshData: () => Promise<void>;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  canRefresh: boolean;
  timeUntilNextUpdate: number;
}

export function useRealTimeStockData({
  symbols: initialSymbols = [],
  intervalMs = 180000, // 3분 간격 (180초)
  enabled = true
}: UseRealTimeStockDataOptions): UseRealTimeStockDataResult {
  // initialSymbols를 직접 사용하지 말고 내부 state 없이 처리
  const [stockData, setStockData] = useState<Record<string, StockData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [canRefresh, setCanRefresh] = useState(true);
  const [timeUntilNextUpdate, setTimeUntilNextUpdate] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(enabled);

  // 카운트다운 업데이트
  const updateCountdown = useCallback(() => {
    if (!lastUpdate) {
      setTimeUntilNextUpdate(0);
      return;
    }
    
    const now = Date.now();
    const nextUpdate = lastUpdate.getTime() + intervalMs;
    const remaining = Math.max(0, Math.ceil((nextUpdate - now) / 1000));
    setTimeUntilNextUpdate(remaining);
    
    if (remaining <= 0) {
      setCanRefresh(true);
    }
  }, [lastUpdate, intervalMs]);

  // 주가 데이터 가져오기
  const fetchStockData = useCallback(async (symbolsToFetch: string[]) => {
    if (symbolsToFetch.length === 0) return;

    setIsLoading(true);
    setError(null);
    console.log(`111`);

    try {
      // 모든 심볼에 대해 병렬로 데이터 가져오기
      const promises = symbolsToFetch.map(async (symbol) => {
        try {
          // 한국 종목 (6자리 숫자)인지 확인
          const isKoreanStock = /^\d{6}$/.test(symbol);
          // 한국 선물/옵션 (M으로 시작하는 8자리)인지 확인
          const isKoreanFutures = /^M\d{8}$/.test(symbol);
          // M0으로 시작하는 금속 선물인지 확인 (야후에서 지원하지 않음)
          const isMetalFutures = /^M0\d{7}$/.test(symbol);
          
          console.log(`Processing symbol: ${symbol}, isMetalFutures: ${isMetalFutures}, isKoreanFutures: ${isKoreanFutures}`);
          
          let response;
          let data = null;
            
          if (isKoreanStock || isMetalFutures) {
            // 한국 종목/선물은 여러 API 순차적으로 시도
            
            // M0으로 시작하는 금속 선물은 야후를 건너뛰고 바로 네이버로
            if (!isMetalFutures) {
              // 1. Yahoo Finance 시도 (금속 선물이 아닌 경우에만)
              try {
                const yahooSymbol = isKoreanStock ? `${symbol}.KS` : symbol;
                response = await fetch(`/api/stock-data/yahoo?symbol=${encodeURIComponent(yahooSymbol)}`);
                if (response.ok) {
                  data = await response.json();
                  console.log(`Yahoo Finance success for ${symbol}`);
                }
              } catch (yahooError) {
                console.warn(`Yahoo Finance failed for ${symbol}:`, yahooError);
              }
            } else {
              console.log(`Skipping Yahoo Finance for metal futures (M0 series): ${symbol}`);
            }

            // 2. Yahoo Finance 실패 시 또는 금속 선물인 경우 네이버 시도
            if (!data) {
              try {
                response = await fetch(`/api/stock-data/naver?symbol=${encodeURIComponent(symbol)}`);
                if (response.ok) {
                  data = await response.json();
                  console.log(`Naver Finance success for ${symbol}`);
                }
              } catch (naverError) {
                console.warn(`Naver Finance failed for ${symbol}:`, naverError);
              }
            }

            // 3. 네이버도 실패 시 기존 Korean API 시도 (일반 주식에만, 마지막 폴백)
            if (!data && isKoreanStock && !isMetalFutures) {
              try {
                response = await fetch(`/api/stock-data/korean?symbol=${encodeURIComponent(symbol)}`);
                if (response.ok) {
                  data = await response.json();
                  console.log(`Korean API fallback success for ${symbol}`);
                }
              } catch (koreanError) {
                console.warn(`Korean API failed for ${symbol}:`, koreanError);
              }
            }

          } else {
            // 해외 종목은 Yahoo Finance API만 사용
            try {
              response = await fetch(`/api/stock-data/yahoo?symbol=${encodeURIComponent(symbol)}`);
              if (response.ok) {
                data = await response.json();
              }
            } catch (yahooError) {
              console.warn(`Yahoo Finance failed for foreign stock ${symbol}:`, yahooError);
            }
          }
          
          if (!data) {
            throw new Error(`All APIs failed for ${symbol}`);
          }
          
          return { symbol, data };
        } catch (err) {
          console.error(`Error fetching data for ${symbol}:`, err);
          return { symbol, data: null };
        }
      });

      const results = await Promise.all(promises);
      
      // 결과를 stockData 객체에 병합
      const newStockData: Record<string, StockData> = {};
      let successCount = 0;
      results.forEach(({ symbol, data }) => {
        if (data) {
          newStockData[symbol] = data;
          successCount++;
        }
      });

      setStockData(prev => ({ ...prev, ...newStockData }));
      setLastUpdate(new Date());
      
      // 일부 실패 시 경고, 전체 실패 시 에러
      if (successCount === 0 && symbolsToFetch.length > 0) {
        setError('모든 종목의 데이터를 가져오는데 실패했습니다.');
      } else if (successCount < symbolsToFetch.length) {
        console.warn(`${symbolsToFetch.length - successCount}개 종목의 데이터를 가져오는데 실패했습니다.`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Stock data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 수동 새로고침 - ref를 사용하여 무한 루프 방지
  const refreshData = useCallback(async () => {
    if (!canRefresh || isLoading) return;
    
    setCanRefresh(false);
    const currentSymbols = symbolsRef.current || [];
    if (currentSymbols.length > 0) {
      await fetchStockData(currentSymbols);
    }
    
    // 수동 새로고침 후 30초 대기 (자동 새로고침과 별도)
    setTimeout(() => {
      setCanRefresh(true);
    }, 30000);
  }, [fetchStockData, canRefresh, isLoading]);

  // 심볼 추가 - 이 기능은 제거 (props로 전달받으므로 불필요)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addSymbol = useCallback((_symbol: string) => {
    // 이 기능은 부모 컴포넌트에서 처리해야 함
    console.warn('addSymbol은 부모 컴포넌트에서 initialSymbols를 변경해서 처리하세요');
  }, []);

  // 심볼 제거 - 이 기능은 제거 (props로 전달받으므로 불필요)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeSymbol = useCallback((_symbol: string) => {
    // 이 기능은 부모 컴포넌트에서 처리해야 함
    console.warn('removeSymbol은 부모 컴포넌트에서 initialSymbols를 변경해서 처리하세요');
  }, []);

  // 실시간 업데이트 설정 - initialSymbols를 ref로 관리하여 무한 루프 방지
  const symbolsRef = useRef(initialSymbols || []);
  symbolsRef.current = initialSymbols || [];

  useEffect(() => {
    console.log('🔥 useEffect triggered:', { enabled });
    isActiveRef.current = enabled;

    if (!enabled) {
      console.log('⚠️ Early return - enabled:', enabled);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    const fetchCurrentSymbols = () => {
      const currentSymbols = symbolsRef.current;
      if (currentSymbols && currentSymbols.length > 0) {
        console.log('📊 Fetching data for symbols:', currentSymbols);
        fetchStockData(currentSymbols);
      }
    };

    // 초기 데이터 로드
    fetchCurrentSymbols();

    // 주기적 업데이트 설정
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        fetchCurrentSymbols();
      }
    }, intervalMs);

    // 카운트다운 업데이트 (1초마다)
    countdownRef.current = setInterval(() => {
      updateCountdown();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled]); // fetchStockData와 updateCountdown는 의도적으로 제외 (무한루프 방지)

  // lastUpdate가 변경될 때마다 카운트다운 초기화 - useEffect 제거하고 직접 호출
  useEffect(() => {
    if (lastUpdate) {
      const now = Date.now();
      const nextUpdate = lastUpdate.getTime() + intervalMs;
      const remaining = Math.max(0, Math.ceil((nextUpdate - now) / 1000));
      setTimeUntilNextUpdate(remaining);
      
      if (remaining <= 0) {
        setCanRefresh(true);
      }
    } else {
      setTimeUntilNextUpdate(0);
    }
  }, [lastUpdate, intervalMs]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  return {
    stockData,
    isLoading,
    error,
    lastUpdate,
    refreshData,
    addSymbol,
    removeSymbol,
    canRefresh,
    timeUntilNextUpdate
  };
}
