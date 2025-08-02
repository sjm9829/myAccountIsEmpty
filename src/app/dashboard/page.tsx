'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useRealTimeStockData } from '@/hooks/useRealTimeStockData';

interface User {
  id: string;
  username: string;
  email: string;
}

interface Institution {
  id: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  nickname?: string;
  institution: Institution;
}

interface Holding {
  id: string;
  stockCode: string;
  stockName: string;
  quantity: number;
  currentPrice: number;
  totalValue: number;
  totalInvestment: number;
  profitLoss: number;
  profitLossPercentage: number;
  currency: string;
  totalValueKRW: number;
  totalInvestmentKRW: number;
  profitLossKRW: number;
  account: Account;
}

interface HoldingWithTodayChange extends Holding {
  todayChangePercent: number;
  todayChange: number;
  todayProfitLoss: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalInvestment: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  exchangeRate: number;
  byCurrency: Record<string, {
    totalValue: number;
    totalInvestment: number;
    totalProfitLoss: number;
    count: number;
  }>;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const router = useRouter();

  // 보유 종목들의 심볼 추출
  const holdingSymbols = useMemo(() => {
    const symbols = [...new Set(holdings.map(holding => holding.stockCode))];
    return symbols;
  }, [holdings]);

  // 실시간 주가 데이터
  const { 
    stockData: realTimeData, 
    lastUpdate: stockLastUpdate,
    isLoading: stockDataLoading,
    error: stockError
  } = useRealTimeStockData({
    symbols: holdingSymbols,
    intervalMs: 300000, // 5분마다 업데이트
    enabled: holdingSymbols.length > 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataError('');
        const [userResponse, holdingsResponse] = await Promise.all([
          fetch('/api/user/me'),
          fetch('/api/portfolio/holdings')
        ]);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData.user);
        } else {
          router.push('/login');
          return;
        }

        if (holdingsResponse.ok) {
          const data = await holdingsResponse.json();
          setHoldings(data.holdings);
          setSummary(data.summary);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setDataError('대시보드 데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // 실시간 데이터로 업데이트된 보유종목
  const updatedHoldings = useMemo(() => {
    if (!realTimeData || Object.keys(realTimeData).length === 0) {
      return holdings;
    }

    return holdings.map(holding => {
      const realtimeStock = realTimeData[holding.stockCode];
      if (realtimeStock && realtimeStock.regularMarketPrice !== undefined) {
        const currentPrice = realtimeStock.regularMarketPrice;
        const totalValue = holding.quantity * currentPrice;
        const profitLoss = totalValue - holding.totalInvestment;
        const profitLossPercentage = holding.totalInvestment > 0 
          ? (profitLoss / holding.totalInvestment) * 100 
          : 0;

        const exchangeRate = summary?.exchangeRate || 1300;
        const totalValueKRW = holding.currency === 'USD' ? totalValue * exchangeRate : totalValue;
        const profitLossKRW = holding.currency === 'USD' ? profitLoss * exchangeRate : profitLoss;

        return {
          ...holding,
          currentPrice,
          totalValue,
          profitLoss,
          profitLossPercentage,
          totalValueKRW,
          profitLossKRW
        };
      }
      return holding;
    });
  }, [holdings, realTimeData, summary?.exchangeRate]);

  // 업데이트된 요약 정보
  const updatedSummary = useMemo(() => {
    if (!summary || updatedHoldings.length === 0) return summary;

    const totalValueKRW = updatedHoldings.reduce((sum, holding) => sum + holding.totalValueKRW, 0);
    const totalInvestmentKRW = updatedHoldings.reduce((sum, holding) => sum + holding.totalInvestmentKRW, 0);
    const totalProfitLossKRW = totalValueKRW - totalInvestmentKRW;
    const totalProfitLossPercentage = totalInvestmentKRW > 0 ? (totalProfitLossKRW / totalInvestmentKRW) * 100 : 0;

    return {
      ...summary,
      totalValue: totalValueKRW,
      totalInvestment: totalInvestmentKRW,
      totalProfitLoss: totalProfitLossKRW,
      totalProfitLossPercentage
    };
  }, [summary, updatedHoldings]);

  // 오늘의 전체 손익 계산
  const todaySummary = useMemo(() => {
    if (!updatedHoldings.length || !updatedSummary) return { 
      totalTodayProfitLoss: 0, 
      totalTodayChangePercent: 0, 
      gainersCount: 0, 
      losersCount: 0,
      unchangedCount: 0
    };

    let totalTodayProfitLoss = 0;
    let gainersCount = 0;
    let losersCount = 0;
    let unchangedCount = 0;

    updatedHoldings.forEach(holding => {
      const stockRealTimeData = realTimeData[holding.stockCode];
      const todayChange = stockRealTimeData?.regularMarketChange || 0;
      const todayChangePercent = stockRealTimeData?.regularMarketChangePercent || 0;
      
      // 보유 수량을 고려한 오늘의 손익 (원화 기준)
      const todayProfitLoss = todayChange * holding.quantity * (summary?.exchangeRate || 1380);
      totalTodayProfitLoss += todayProfitLoss;

      if (todayChangePercent > 0) gainersCount++;
      else if (todayChangePercent < 0) losersCount++;
      else unchangedCount++;
    });

    const totalTodayChangePercent = updatedSummary.totalValue > 0 
      ? (totalTodayProfitLoss / (updatedSummary.totalValue - totalTodayProfitLoss)) * 100 
      : 0;

    return {
      totalTodayProfitLoss,
      totalTodayChangePercent,
      gainersCount,
      losersCount,
      unchangedCount
    };
  }, [updatedHoldings, realTimeData, summary, updatedSummary]);

  // 오늘의 상승/하락 종목 (TOP 3) - 오늘 하루 변화율 기준
  const todayMovers = useMemo(() => {
    if (!updatedHoldings.length) return { gainers: [], losers: [] };

    // 실시간 데이터에서 오늘의 변화율을 가져와서 계산
    const holdingsWithTodayChange = updatedHoldings.map(holding => {
      const stockRealTimeData = realTimeData[holding.stockCode];
      const todayChangePercent = stockRealTimeData?.regularMarketChangePercent || 0;
      const todayChange = stockRealTimeData?.regularMarketChange || 0;
      
      // 보유 수량을 고려한 오늘의 손익 (원화 기준)
      const todayProfitLoss = todayChange * holding.quantity * (summary?.exchangeRate || 1380);
      
      return {
        ...holding,
        todayChangePercent,
        todayChange,
        todayProfitLoss
      } as HoldingWithTodayChange;
    });

    const sortedByTodayChange = holdingsWithTodayChange
      .filter(holding => holding.todayChangePercent !== 0)
      .sort((a, b) => b.todayChangePercent - a.todayChangePercent);

    return {
      gainers: sortedByTodayChange.filter(h => h.todayChangePercent > 0).slice(0, 3),
      losers: sortedByTodayChange.filter(h => h.todayChangePercent < 0).slice(-3).reverse()
    };
  }, [updatedHoldings, realTimeData, summary]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">대시보드 데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                📊 실시간 대시보드 {user?.username && <span className="text-blue-600">- {user.username}님</span>}
              </h1>
              <p className="text-gray-600">오늘의 포트폴리오 현황과 실시간 시장 동향</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                마지막 업데이트: {stockLastUpdate ? new Date(stockLastUpdate).toLocaleTimeString('ko-KR') : '업데이트 없음'}
              </div>
              <div className="flex items-center justify-end mt-1">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  stockDataLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'
                }`}></div>
                <span className="text-xs text-gray-500">
                  {stockDataLoading ? '실시간 업데이트 중...' : '실시간 연결됨'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {dataError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700">{dataError}</span>
            </div>
          </div>
        )}

        {/* 오늘의 포트폴리오 현황 */}
        {updatedSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {/* 오늘의 총 손익 */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg shadow p-6 border-l-4 border-orange-400">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">오늘의 손익</p>
                  <p className={`text-2xl font-bold ${
                    todaySummary.totalTodayProfitLoss >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {todaySummary.totalTodayProfitLoss >= 0 ? '+' : ''}₩{todaySummary.totalTodayProfitLoss.toLocaleString()}
                  </p>
                  <p className={`text-sm ${
                    todaySummary.totalTodayChangePercent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {todaySummary.totalTodayChangePercent >= 0 ? '+' : ''}{todaySummary.totalTodayChangePercent.toFixed(2)}%
                  </p>
                </div>
                <div className="p-3 bg-orange-200 dark:bg-orange-700/50 rounded-full">
                  <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 상승 종목 수 */}
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow p-6 border-l-4 border-red-400">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">상승 종목</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {todaySummary.gainersCount}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    총 {updatedHoldings.length}종목 중
                  </p>
                </div>
                <div className="p-3 bg-red-200 dark:bg-red-700/50 rounded-full">
                  <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 하락 종목 수 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow p-6 border-l-4 border-blue-400">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">하락 종목</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {todaySummary.losersCount}
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    총 {updatedHoldings.length}종목 중
                  </p>
                </div>
                <div className="p-3 bg-blue-200 dark:bg-blue-700/50 rounded-full">
                  <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 보합 종목 수 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-gray-400">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">보합 종목</p>
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {todaySummary.unchangedCount}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    총 {updatedHoldings.length}종목 중
                  </p>
                </div>
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <svg className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* 오늘의 상승 종목 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              📈 오늘의 상승 종목
            </h3>
            {todayMovers.gainers.length > 0 ? (
              <div className="space-y-3">
                {todayMovers.gainers.map((holding) => (
                  <div key={holding.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{holding.stockName}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{holding.stockCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600 dark:text-red-400">+{holding.todayChangePercent.toFixed(2)}%</p>
                      <p className="text-sm text-red-600 dark:text-red-400">+₩{holding.todayProfitLoss.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">오늘 상승한 종목이 없습니다</p>
            )}
          </div>

          {/* 오늘의 하락 종목 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              📉 오늘의 하락 종목
            </h3>
            {todayMovers.losers.length > 0 ? (
              <div className="space-y-3">
                {todayMovers.losers.map((holding) => (
                  <div key={holding.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{holding.stockName}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{holding.stockCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600 dark:text-blue-400">{holding.todayChangePercent.toFixed(2)}%</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">₩{holding.todayProfitLoss.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">오늘 하락한 종목이 없습니다</p>
            )}
          </div>

          {/* 빠른 액션 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⚡ 빠른 액션</h3>
            <div className="space-y-3">
              <Link
                href="/transactions"
                className="flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="font-medium text-gray-900">거래 내역 등록</span>
                </div>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/holdings"
                className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 4h.01M9 16h.01" />
                  </svg>
                  <span className="font-medium text-gray-900">보유종목 관리</span>
                </div>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/analytics"
                className="flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-purple-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="font-medium text-gray-900">전체 포트폴리오 분석</span>
                </div>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* 실시간 업데이트 상태 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">� 실시간 데이터 상태</h3>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    stockDataLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'
                  }`}></div>
                  <span className="text-gray-600 dark:text-gray-400">
                    {stockDataLoading ? '업데이트 중...' : '연결됨'}
                  </span>
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  업데이트 주기: 5분
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  추적 종목: {holdingSymbols.length}개
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
              마지막 업데이트: {stockLastUpdate ? new Date(stockLastUpdate).toLocaleString('ko-KR') : '업데이트 없음'}
            </div>
          </div>
        </div>

        {/* 데이터 업데이트 정보 */}
        {stockLastUpdate && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>마지막 업데이트: {new Date(stockLastUpdate).toLocaleString('ko-KR')}</span>
              </div>
              {stockError && (
                <div className="flex items-center text-red-600">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>실시간 데이터 업데이트 오류</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && updatedHoldings.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">포트폴리오를 시작하세요!</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              두 가지 방법으로 포트폴리오 관리를 시작할 수 있습니다.
            </p>
            
            {/* 하이브리드 옵션 소개 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="font-medium text-green-800 dark:text-green-300">거래내역 기반 (권장)</h4>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                  매수/매도 거래를 등록하면 보유종목이 자동으로 계산됩니다.
                </p>
                <Link
                  href="/transactions"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  거래내역 등록하기
                </Link>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <h4 className="font-medium text-blue-800 dark:text-blue-300">직접 입력</h4>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                  현재 보유 상황을 직접 입력하여 바로 시작할 수 있습니다.
                </p>
                <Link
                  href="/holdings"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  보유종목 직접 입력
                </Link>
              </div>
            </div>
            
            <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-600">
              <Link
                href="/accounts"
                className="inline-flex items-center px-4 py-2 border border-gray-200 dark:border-gray-500 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                먼저 계좌 등록하기
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
