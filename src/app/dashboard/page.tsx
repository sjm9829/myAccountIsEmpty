'use client';

import { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';

// 간단한 타입 정의
interface PortfolioSnapshot {
  totalValue: number;
  todayChange: number;
  todayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

interface StockItem {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  todayChange: number;
  todayChangePercent: number;
  quantity: number;
  profitLoss: number;
  profitLossPercent: number;
  currency: string;
}

interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

interface TodayAlert {
  id: string;
  type: 'surge' | 'drop' | 'dividend' | 'news' | 'earnings' | 'economic';
  stockName: string;
  message: string;
  value?: number;
  priority?: 'high' | 'medium' | 'low';
  country?: string; // 국가 정보 추가
  date?: string; // 날짜 정보 추가
}

export default function SimpleDashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [topStocks, setTopStocks] = useState<StockItem[]>([]);
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [todayAlerts, setTodayAlerts] = useState<TodayAlert[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isMarketOpen, setIsMarketOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingPortfolio, setIsUpdatingPortfolio] = useState(false);
  const [isUpdatingIndices, setIsUpdatingIndices] = useState(false);
  const [isUpdatingEvents, setIsUpdatingEvents] = useState(false);

  // 포트폴리오 데이터 업데이트
  const updatePortfolioData = useCallback(async () => {
    try {
      setIsUpdatingPortfolio(true);
      const holdingsRes = await fetch('/api/portfolio/holdings', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (holdingsRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      if (holdingsRes.ok) {
        const data = await holdingsRes.json();
        
        // 포트폴리오 스냅샷 설정
        if (data.summary) {
          setPortfolio({
            totalValue: Math.round(data.summary.totalValue || 0),
            todayChange: Math.round(data.summary.totalTodayChange || 0),
            todayChangePercent: Number((data.summary.totalTodayChangePercent || 0).toFixed(2)),
            totalReturn: Math.round(data.summary.totalProfitLoss || 0),
            totalReturnPercent: Number((data.summary.totalProfitLossPercentage || 0).toFixed(2))
          });
        }
        
        // 보유 종목 데이터 업데이트
        const stocks = data.holdings?.map((item: {
          stockCode: string;
          stockName: string;
          currentPrice: number;
          dailyChangePercent: number;
          quantity: number;
          profitLoss: number;
          profitLossPercentage: number;
          currency?: string;
          dailyChange?: number;
        }) => ({
          stockCode: item.stockCode,
          stockName: item.stockName,
          currentPrice: item.currentPrice || 0,
          todayChange: item.dailyChange || ((item.currentPrice || 0) * ((item.dailyChangePercent || 0) / 100) / (1 + ((item.dailyChangePercent || 0) / 100))), // 종목 자체의 등락금액
          todayChangePercent: item.dailyChangePercent || 0,
          quantity: item.quantity,
          profitLoss: item.profitLoss || 0,
          profitLossPercent: item.profitLossPercentage || 0,
          currency: item.currency || 'KRW' // 기본값을 KRW로 설정
        })) || [];
        
        // 당일 수익률 기준 내림차순 정렬
        stocks.sort((a: StockItem, b: StockItem) => b.todayChangePercent - a.todayChangePercent);
        
        setTopStocks(stocks);
        
        // 오늘의 알림 생성 - 기존 급등/급락 알림만 먼저 생성
        const alerts: TodayAlert[] = [];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // 급등/급락 종목 확인
        stocks.forEach((stock: StockItem) => {
          if (stock.todayChangePercent >= 5) {
            alerts.push({
              id: `surge-${stock.stockCode}`,
              type: 'surge',
              stockName: stock.stockName,
              message: `+${stock.todayChangePercent.toFixed(1)}% 급등`,
              value: stock.todayChangePercent,
              priority: 'high',
              date: todayStr
            });
          } else if (stock.todayChangePercent <= -4) {
            alerts.push({
              id: `drop-${stock.stockCode}`,
              type: 'drop',
              stockName: stock.stockName,
              message: `${stock.todayChangePercent.toFixed(1)}% 급락`,
              value: stock.todayChangePercent,
              priority: 'high',
              date: todayStr
            });
          }
        });

        // 임시로 급등/급락 알림만 설정 (이벤트 알림은 별도 함수에서 추가)
        setTodayAlerts(alerts); // slice 제거
        
      }
    } catch (error) {
      console.error('포트폴리오 데이터 업데이트 실패:', error);
    } finally {
      setIsUpdatingPortfolio(false);
    }
  }, []);

  // 이벤트 알림 업데이트
  const updateEventAlerts = useCallback(async () => {
    try {
      setIsUpdatingEvents(true);
      const response = await fetch('/api/events', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 기존 급등/급락 알림과 이벤트 알림 합치기
          setTodayAlerts(prevAlerts => {
            const combinedAlerts = [...prevAlerts, ...result.data];
            
            // 급등/급락 알림을 최상단 고정, 그 외는 날짜 오름차순 정렬
            return combinedAlerts
              .sort((a, b) => {
                // 급등/급락 알림은 최상단 고정
                const isAUrgent = a.type === 'surge' || a.type === 'drop';
                const isBUrgent = b.type === 'surge' || b.type === 'drop';
                
                if (isAUrgent && !isBUrgent) return -1;
                if (!isAUrgent && isBUrgent) return 1;
                
                // 둘 다 급등/급락이거나 둘 다 일반 알림인 경우 날짜 오름차순
                if (a.date && b.date) {
                  return new Date(a.date).getTime() - new Date(b.date).getTime();
                }
                
                // 날짜가 없는 경우 기본 정렬
                return 0;
              });
          });
        }
      } else {
        console.error('이벤트 API 호출 실패:', response.status);
      }
    } catch (error) {
      console.error('이벤트 알림 업데이트 실패:', error);
    } finally {
      setIsUpdatingEvents(false);
    }
  }, []);

  // 시장 지수 업데이트
  const updateMarketIndices = useCallback(async () => {
    try {
      setIsUpdatingIndices(true);
      const response = await fetch('/api/market-indices', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setMarketIndices(result.data);
        } else {
          console.error('주요 지수 데이터 형식 오류:', result);
          setMarketIndices([]);
        }
      } else {
        console.error('주요 지수 API 호출 실패:', response.status);
        setMarketIndices([]);
      }
    } catch (error) {
      console.error('시장 지수 업데이트 실패:', error);
      setMarketIndices([]);
    } finally {
      setIsUpdatingIndices(false);
    }
  }, []);


  const fetchInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        updatePortfolioData(),
        updateMarketIndices()
      ]);
      // 포트폴리오 데이터 로딩 후 이벤트 알림 업데이트
      await updateEventAlerts();
      setLastUpdate(new Date());
    } catch (error) {
      console.error('초기 데이터 로딩 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [updatePortfolioData, updateMarketIndices, updateEventAlerts]);

  // 개별 섹션 업데이트 (비동기)
  const updateAllSections = useCallback(async () => {
    try {
      // 각 섹션을 병렬로 업데이트
      await Promise.all([
        updatePortfolioData(),
        updateMarketIndices()
      ]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('섹션 업데이트 실패:', error);
    }
  }, [updatePortfolioData, updateMarketIndices]);

  // 초기 데이터 로딩
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 시장 상태 확인
  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const hour = now.getHours();
      const koreanMarketOpen = hour >= 9 && hour < 18;
      const usMarketOpen = hour >= 22 || hour < 6;
      setIsMarketOpen(koreanMarketOpen || usMarketOpen);
    };

    checkMarketStatus();
    const statusInterval = setInterval(checkMarketStatus, 60000);
    return () => clearInterval(statusInterval);
  }, []);

  // 이벤트 알림 정기 업데이트 (30분마다)
  useEffect(() => {
    const eventUpdateInterval = setInterval(() => {
      updateEventAlerts();
    }, 30 * 60 * 1000); // 30분 = 30 * 60 * 1000ms

    return () => clearInterval(eventUpdateInterval);
  }, [updateEventAlerts]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">포트폴리오 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 헤더 - 실시간 상태 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              포트폴리오 현황
            </h1>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {isMarketOpen ? '실시간' : '휴장'}
              </span>
              {(isUpdatingPortfolio || isUpdatingIndices) && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-600 dark:text-blue-400">업데이트 중</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {lastUpdate.toLocaleTimeString()}
            </div>
            <button
              onClick={updateAllSections}
              disabled={isUpdatingPortfolio || isUpdatingIndices}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-3 h-3 mr-1 ${(isUpdatingPortfolio || isUpdatingIndices) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {(isUpdatingPortfolio || isUpdatingIndices) ? '업데이트 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {/* 포트폴리오 현황 */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">

            {portfolio ? (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 총 평가금액 */}
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">총 평가금액</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      ₩{portfolio.totalValue.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400"></div>
                  </div>
                  
                  {/* 오늘 손익 */}
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">오늘 손익</div>
                    <div className={`text-3xl font-bold mb-1 ${
                      portfolio.todayChange > 0 ? 'text-red-600 dark:text-red-400' : 
                      portfolio.todayChange < 0 ? 'text-blue-600 dark:text-blue-400' : 
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      {portfolio.todayChange > 0 ? '+' : ''}₩{Math.abs(portfolio.todayChange).toLocaleString()}
                    </div>
                    <div className={`text-sm font-semibold ${
                      portfolio.todayChangePercent > 0 ? 'text-red-600 dark:text-red-400' : 
                      portfolio.todayChangePercent < 0 ? 'text-blue-600 dark:text-blue-400' : 
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      ({portfolio.todayChangePercent > 0 ? '+' : ''}{portfolio.todayChangePercent}%)
                    </div>
                  </div>
                  
                  {/* 총 수익률 */}
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">총 수익률</div>
                    <div className={`text-3xl font-bold mb-1 ${
                      portfolio.totalReturn > 0 ? 'text-red-600 dark:text-red-400' : 
                      portfolio.totalReturn < 0 ? 'text-blue-600 dark:text-blue-400' : 
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      {portfolio.totalReturn > 0 ? '+' : ''}₩{Math.abs(portfolio.totalReturn).toLocaleString()}
                    </div>
                    <div className={`text-sm font-semibold ${
                      portfolio.totalReturnPercent > 0 ? 'text-red-600 dark:text-red-400' : 
                      portfolio.totalReturnPercent < 0 ? 'text-blue-600 dark:text-blue-400' : 
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      ({portfolio.totalReturnPercent > 0 ? '+' : ''}{portfolio.totalReturnPercent}%)
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="animate-pulse text-gray-500 dark:text-gray-400">데이터 로딩 중...</div>
              </div>
            )}
          </div>
        </div>

        {/* 보유 종목 및 시장 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          {/* 보유 종목 당일 현황 */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                보유 종목 현황 ({topStocks.length}개)
              </h3>
            </div>
            <div className="p-4">
              <div className="space-y-2 max-h-180 overflow-y-auto">
                {topStocks.map((stock, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex-1 min-w-0 flex-grow-2">
                      <div className="font-semibold text-gray-900 dark:text-white text-base truncate" title={stock.stockName}>
                        {stock.stockName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {stock.quantity}주
                      </div>
                    </div>
                    <div className="text-center w-24 flex-shrink-0 mx-2">
                      <div className="font-semibold text-gray-900 dark:text-white text-base">
                        {stock.currency === 'USD' ? '$' : '₩'}{stock.currentPrice.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right w-28 flex-shrink-0 mr-2">
                      <div className={`font-semibold text-base ${
                        stock.todayChangePercent > 0 ? 'text-red-600 dark:text-red-400' : 
                        stock.todayChangePercent < 0 ? 'text-blue-600 dark:text-blue-400' : 
                        'text-gray-700 dark:text-gray-300'
                      }`}>
                        {stock.todayChangePercent > 0 ? '+' : stock.todayChangePercent < 0 ? '-' : ''}{stock.currency === 'USD' ? '$' : '₩'}{Math.abs(stock.todayChange).toLocaleString()}
                      </div>
                      <div className={`text-sm ${
                        stock.todayChangePercent > 0 ? 'text-red-600 dark:text-red-400' : 
                        stock.todayChangePercent < 0 ? 'text-blue-600 dark:text-blue-400' : 
                        'text-gray-700 dark:text-gray-300'
                      }`}>
                        ({stock.todayChangePercent > 0 ? '+' : stock.todayChangePercent < 0 ? '' : ''}{stock.todayChangePercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 주요 지수 + 오늘의 알림 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 주요 지수 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">주요 지수</h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {marketIndices.map((index, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {index.name}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {index.name.includes('USD/KRW') ? 
                            `₩${index.value.toFixed(2)}` : 
                            index.name.includes('JPY(100)/KRW') ?
                            `₩${index.value.toFixed(0)}` :
                            index.value.toLocaleString()
                          }
                        </div>
                        <div className={`text-sm ${
                          index.changePercent > 0 ? 'text-red-600 dark:text-red-400' : 
                          index.changePercent < 0 ? 'text-blue-600 dark:text-blue-400' : 
                          'text-gray-700 dark:text-gray-300'
                        }`}>
                          {index.changePercent > 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 오늘의 알림 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">오늘의 알림</h3>
              </div>
              <div className="p-4">
                {todayAlerts.length > 0 ? (
                  <div className="space-y-2 max-h-90 overflow-y-auto">
                    {todayAlerts.map((alert) => (
                      <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
                        alert.type === 'surge' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                        alert.type === 'drop' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' :
                        alert.type === 'dividend' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' :
                        alert.type === 'earnings' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500' :
                        alert.type === 'economic' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' :
                        alert.type === 'news' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500' :
                        'bg-gray-50 dark:bg-gray-700/20 border-gray-500'
                      }`}>
                        <div className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                          {alert.country && (alert.type === 'economic' || alert.type === 'news') ? alert.country : alert.stockName}
                        </div>
                        <div className={`text-xs ${
                          alert.type === 'surge' ? 'text-red-700 dark:text-red-300' :
                          alert.type === 'drop' ? 'text-blue-700 dark:text-blue-300' :
                          alert.type === 'dividend' ? 'text-blue-700 dark:text-blue-300' :
                          alert.type === 'earnings' ? 'text-purple-700 dark:text-purple-300' :
                          alert.type === 'economic' ? 'text-yellow-700 dark:text-yellow-300' :
                          alert.type === 'news' ? 'text-indigo-700 dark:text-indigo-300' :
                          'text-gray-700 dark:text-gray-300'
                        }`}>
                          {alert.message}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-3">
                    <svg className="w-6 h-6 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm">안정적인 하루입니다</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
