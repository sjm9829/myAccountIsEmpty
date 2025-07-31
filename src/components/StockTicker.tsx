'use client';

import { useState } from 'react';

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

interface StockTickerProps {
  symbols: string[];
  stockData: Record<string, StockData>;
  stockNames?: Record<string, string>; // 종목코드 -> 종목명 매핑
  className?: string;
  isLoading?: boolean;
  lastUpdate?: Date | null;
  error?: string | null;
  onRefresh?: () => void;
  canRefresh?: boolean; // 새로고침 가능 여부
}

export default function StockTicker({ 
  symbols, 
  stockData,
  stockNames = {},
  className = '', 
  isLoading = false,
  lastUpdate,
  error = null,
  onRefresh,
  canRefresh = true
}: StockTickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 디버깅 로그 추가
  console.log('🎨 StockTicker symbols:', symbols);
  console.log('🎨 StockTicker stockData:', stockData);
  console.log('🎨 StockTicker stockNames:', stockNames);
  console.log('🎨 StockTicker available data keys:', Object.keys(stockData));
  
  // 각 심볼별로 데이터 상태 확인
  symbols.forEach(symbol => {
    const data = stockData[symbol];
    console.log(`🎨 Symbol ${symbol}:`, {
      hasData: !!data,
      stockName: stockNames[symbol],
      shortName: data?.shortName,
      longName: data?.longName,
      price: data?.regularMarketPrice
    });
  });

  const formatPrice = (price: number, currency: string = 'KRW') => {
    if (currency === 'KRW') {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
      }).format(price);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatChange = (data: StockData) => {
    let change = data.regularMarketChange;
    let changePercent = data.regularMarketChangePercent;
    let tooltipText = "전일 종가 대비 변동률";
    
    console.log(`💰 Original change data for ${data.symbol}:`, {
      regularMarketChange: data.regularMarketChange,
      regularMarketChangePercent: data.regularMarketChangePercent,
      regularMarketPrice: data.regularMarketPrice,
      previousClose: data.previousClose,
      regularMarketPreviousClose: data.regularMarketPreviousClose,
      afterMarketClose: data.afterMarketClose,
      previousTradingDayData: data.previousTradingDayData
    });
    
    // 장 마감 후 등락이 0이거나 매우 작을 때 전일 종가 대비로 재계산
    if (Math.abs(change) < 0.01 && Math.abs(changePercent) < 0.01) {
      console.log(`🔄 Recalculating change for ${data.symbol} due to zero change`);
      
      const actualPreviousClose = data.regularMarketPreviousClose || data.previousClose;
      
      if (actualPreviousClose && actualPreviousClose > 0) {
        // 현재가와 실제 전일 종가 비교
        change = data.regularMarketPrice - actualPreviousClose;
        changePercent = (change / actualPreviousClose) * 100;
        
        console.log(`📈 Recalculated change for ${data.symbol}:`, {
          currentPrice: data.regularMarketPrice,
          previousClose: actualPreviousClose,
          recalculatedChange: change,
          recalculatedChangePercent: changePercent,
          originalChange: data.regularMarketChange,
          originalChangePercent: data.regularMarketChangePercent,
          afterMarketClose: data.afterMarketClose,
          previousTradingDayUsed: data.previousTradingDayData ? true : false
        });
      } else {
        console.warn(`⚠️ No valid previous close found for ${data.symbol}`);
      }
    }
    
    // 이전 영업일 데이터가 있는 경우 툴팁에 추가 정보 표시
    if (data.afterMarketClose && data.previousTradingDayData) {
      tooltipText = `이전 영업일(${data.previousTradingDayData.date}) 대비 변동률`;
      console.log(`📅 Using previous trading day data for ${data.symbol}: ${tooltipText}`);
    }
    
    const sign = change >= 0 ? '+' : '';
    const colorClass = change >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400';
    const formattedChange = new Intl.NumberFormat('ko-KR').format(Math.round(change));
    
    console.log(`🎨 Final formatted change for ${data.symbol}:`, {
      change,
      changePercent,
      formattedChange,
      sign,
      tooltipText
    });
    
    return (
      <span className={colorClass} title={tooltipText}>
        {sign}{formattedChange} ({sign}{changePercent.toFixed(2)}%)
      </span>
    );
  };

  if (symbols.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : error ? 'bg-red-500' : 'bg-green-500'}`} />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              실시간 주가
            </h3>
            {error && (
              <span className="text-xs text-red-600 dark:text-red-400 ml-1" title={error}>
                (오류)
              </span>
            )}
          </div>
          
          {/* 업데이트 정보 */}
          <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
            {lastUpdate && !error && (
              <span title="마지막 업데이트 시간">
                마지막 업데이트: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isLoading || !onRefresh || !canRefresh}
            className={`p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 ${
              !canRefresh ? 'cursor-not-allowed' : ''
            }`}
            title={!canRefresh ? '새로고침 대기 중...' : '새로고침'}
          >
            <svg 
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg 
              className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 주가 목록 */}
      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-96 overflow-y-auto' : 'max-h-20 overflow-hidden'}`}>
        {error && isExpanded && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}
        
        {symbols.map((symbol, index) => {
          const data = stockData[symbol];
          const uniqueKey = `${symbol}-${index}`; // 중복 key 방지를 위해 index 추가
          
          if (!data) {
            return (
              <div key={uniqueKey} className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div>
                    <div className="w-16 sm:w-20 h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="w-12 sm:w-16 h-2 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-12 sm:w-16 h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="w-8 sm:w-12 h-2 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
                </div>
              </div>
            );
          }

          return (
            <div key={uniqueKey} className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-750">
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {symbol.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {stockNames[symbol] || data.shortName || data.longName || symbol}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {symbol}
                  </p>
                </div>
              </div>
              
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatPrice(data.regularMarketPrice, data.currency)}
                </p>
                <p className="text-xs">
                  {formatChange(data)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 간단히 보기 모드에서 스크롤 힌트 */}
      {!isExpanded && symbols.length > 1 && (
        <div className="p-2 text-center">
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {symbols.length}개 종목 모두 보기 ↓
          </button>
        </div>
      )}
    </div>
  );
}
