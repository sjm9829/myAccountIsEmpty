'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRealTimeStockData } from '@/hooks/useRealTimeStockData';
import Navigation from '@/components/Navigation';

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  nickname?: string;
  institution: {
    id: string;
    name: string;
    type: string;
  };
}

interface Holding {
  id: string;
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  totalValue?: number;
  profitLoss?: number;
  profitLossPercentage?: number;
  currency: string;
  totalValueKRW: number;
  totalInvestmentKRW: number;
  profitLossKRW: number;
  account: {
    id: string;
    accountNumber: string;
    accountType: string;
    nickname?: string;
    institution: {
      id: string;
      name: string;
      type: string;
    };
  };
}

interface PortfolioAnalytics {
  totalValue: number;
  totalInvestment: number;
  totalReturn: number;
  returnPercent: number;
  sectorAllocation: { [key: string]: number };
  topPerformers: Array<{
    stockCode: string;
    name: string;
    returnPercent: number;
    value: number;
  }>;
  riskMetrics: {
    volatility: number;
    sharpeRatio: number;
    diversificationScore: number;
    beta: number;
    maxDrawdown: number;
  };
  performance: {
    kospiComparison: number;
    monthlyReturns: number[];
    winRate: number;
  };
}

export default function AnalyticsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 실시간 주식 데이터 훅
  const stockCodes = useMemo(() => Array.isArray(holdings) ? holdings.map(h => h.stockCode) : [], [holdings]);
  const {
    stockData: realTimeData,
    isLoading: stockDataLoading,
    error: stockDataError,
    lastUpdate: stockLastUpdate
  } = useRealTimeStockData({
    symbols: stockCodes,
    intervalMs: 180000, // 3분
    enabled: true
  });

  // 계좌 데이터 가져오기
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, []);

  // 보유종목 데이터 가져오기
  const fetchHoldings = useCallback(async () => {
    try {
      const response = await fetch('/api/portfolio/holdings');
      if (!response.ok) {
        throw new Error('보유종목 데이터를 가져오는데 실패했습니다.');
      }
      const data = await response.json();
      console.log('Holdings API response:', data);
      setHoldings(Array.isArray(data.holdings) ? data.holdings : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      console.error('Error fetching holdings:', err);
    }
  }, []);

  // 섹터 매핑 함수
  const getSector = (stockCode: string): string => {
    const sectorMapping: { [key: string]: string } = {
      '005930': 'IT/반도체',
      '000660': '금융',
      '035420': 'IT/통신',
      '051910': 'IT/소프트웨어',
      '028260': '바이오/헬스케어',
      '373220': '에너지/배터리',
      '476800': 'IT/소프트웨어',
      '000270': '자동차/운송',
      '068270': '바이오/헬스케어',
      '003670': '철강/소재',
      '096770': '에너지/화학',
      '017670': 'IT/통신',
      '018260': '건설/부동산',
      '323410': '금융/증권',
      'AAPL': 'IT/기술',
      'GOOGL': 'IT/기술',
      'MSFT': 'IT/기술',
      'TSLA': '자동차/운송',
      'NVDA': 'IT/반도체'
    };
    return sectorMapping[stockCode] || '기타';
  };

  // 포트폴리오 분석 계산
  const calculateAnalytics = useCallback((): PortfolioAnalytics => {
    if (!Array.isArray(holdings) || !holdings.length) {
      return {
        totalValue: 0,
        totalInvestment: 0,
        totalReturn: 0,
        returnPercent: 0,
        sectorAllocation: {},
        topPerformers: [],
        riskMetrics: {
          volatility: 0,
          sharpeRatio: 0,
          diversificationScore: 0,
          beta: 0,
          maxDrawdown: 0
        },
        performance: {
          kospiComparison: 0,
          monthlyReturns: [],
          winRate: 0
        }
      };
    }

    let totalValue = 0;
    let totalInvestment = 0;
    const sectorAllocation: { [key: string]: number } = {};
    const performanceData: Array<{
      stockCode: string;
      name: string;
      returnPercent: number;
      value: number;
    }> = [];

    // 각 종목별 계산
    holdings.forEach(holding => {
      const stockData = realTimeData[holding.stockCode];
      const currentPrice = stockData?.regularMarketPrice || holding.currentPrice || holding.averagePrice;
      const holdingValue = holding.totalValue || (holding.quantity * currentPrice);
      const investment = holding.quantity * holding.averagePrice;
      const returnPercent = holding.profitLossPercentage || (((currentPrice - holding.averagePrice) / holding.averagePrice) * 100);

      totalValue += holdingValue;
      totalInvestment += investment;

      // 섹터별 배분
      const sector = getSector(holding.stockCode);
      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + holdingValue;

      // 성과 데이터
      performanceData.push({
        stockCode: holding.stockCode,
        name: holding.stockName,
        returnPercent,
        value: holdingValue
      });
    });

    // 섹터 배분을 퍼센트로 변환
    Object.keys(sectorAllocation).forEach(sector => {
      sectorAllocation[sector] = (sectorAllocation[sector] / totalValue) * 100;
    });

    // 상위 수익률 종목 정렬
    const topPerformers = performanceData
      .sort((a, b) => b.returnPercent - a.returnPercent)
      .slice(0, 5);

    // 리스크 지표 계산
    const returns = performanceData.map(p => p.returnPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
    const diversificationScore = Math.min(100, holdings.length * 10);
    const beta = volatility > 0 ? volatility / 20 : 1;
    const maxDrawdown = Math.min(...returns, 0);

    return {
      totalValue,
      totalInvestment,
      totalReturn: totalValue - totalInvestment,
      returnPercent: totalInvestment > 0 ? ((totalValue - totalInvestment) / totalInvestment) * 100 : 0,
      sectorAllocation,
      topPerformers,
      riskMetrics: {
        volatility: Number(volatility.toFixed(2)),
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        diversificationScore: Number(diversificationScore.toFixed(1)),
        beta: Number(beta.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2))
      },
      performance: {
        kospiComparison: avgReturn - 5,
        monthlyReturns: returns.slice(0, 12),
        winRate: returns.filter(r => r > 0).length / returns.length * 100
      }
    };
  }, [holdings, realTimeData]);

  // 분석 데이터 업데이트
  useEffect(() => {
    if (Array.isArray(holdings) && holdings.length > 0) {
      const analyticsData = calculateAnalytics();
      setAnalytics(analyticsData);
      setIsLoading(false);
    } else if (Array.isArray(holdings) && holdings.length === 0) {
      setIsLoading(false);
    }
  }, [holdings, realTimeData, calculateAnalytics]);

  // 초기 데이터 로딩
  useEffect(() => {
    const fetchAllData = async () => {
      await Promise.all([
        fetchHoldings(),
        fetchAccounts()
      ]);
    };
    fetchAllData();
  }, [fetchHoldings, fetchAccounts]);

  // 계좌 표시명 생성 함수
  const getAccountDisplayName = (account: Account) => {
    if (account.nickname) {
      return `${account.nickname} (${account.institution.name})`;
    }
    const maskedAccountNumber = account.accountNumber.length > 8 
      ? `${account.accountNumber.slice(0, 4)}****${account.accountNumber.slice(-4)}`
      : account.accountNumber;
    return `${account.institution.name} - ${maskedAccountNumber}`;
  };

  // 로딩 스켈레톤 컴포넌트
  const SkeletonCard = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-1"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    오류가 발생했습니다
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 헤더 */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  📈 포트폴리오 분석
                </h1>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  투자 성과 분석, 리스크 평가 및 포트폴리오 최적화 인사이트
                </p>
              </div>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 flex-wrap gap-2">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    stockDataLoading ? 'bg-yellow-400 animate-pulse' : 
                    stockDataError ? 'bg-red-400' : 'bg-green-400'
                  }`} />
                  {stockDataLoading ? '분석 데이터 업데이트 중...' : 
                   stockDataError ? '연결 오류' : '실시간 연결'}
                </div>
                <div>보유종목: {Array.isArray(holdings) ? holdings.length : 0}개</div>
                <div>실시간 데이터: {Object.keys(realTimeData).length}개</div>
                {stockLastUpdate && (
                  <div>최종 업데이트: {new Date(stockLastUpdate).toLocaleTimeString()}</div>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : analytics ? (
            <>
              {/* 포트폴리오 요약 카드 (4열) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">총 평가금액</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ₩{analytics.totalValue.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                      <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">총 투자금액</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ₩{analytics.totalInvestment.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
                      <svg className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">총 손익</p>
                      <p className={`text-2xl font-bold ${
                        analytics.totalReturn >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {analytics.totalReturn >= 0 ? '+' : ''}₩{analytics.totalReturn.toLocaleString()}
                      </p>
                    </div>
                    <div className={`p-3 rounded-full ${
                      analytics.totalReturn >= 0 ? 'bg-red-100 dark:bg-red-900/20' : 'bg-blue-100 dark:bg-blue-900/20'
                    }`}>
                      <svg className={`h-6 w-6 ${
                        analytics.totalReturn >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {analytics.totalReturn >= 0 ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        )}
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">수익률</p>
                      <p className={`text-2xl font-bold ${
                        analytics.returnPercent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {analytics.returnPercent >= 0 ? '+' : ''}{analytics.returnPercent.toFixed(2)}%
                      </p>
                    </div>
                    <div className={`p-3 rounded-full ${
                      analytics.returnPercent >= 0 ? 'bg-red-100 dark:bg-red-900/20' : 'bg-blue-100 dark:bg-blue-900/20'
                    }`}>
                      <svg className={`h-6 w-6 ${
                        analytics.returnPercent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* 주요 지표 카드 - 더 넓은 레이아웃 (3열) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    💼 포트폴리오 가치
                  </h3>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white break-all">
                    ₩{analytics.totalValue.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">
                    투자원금: ₩{analytics.totalInvestment.toLocaleString()}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    📈 총 수익률
                  </h3>
                  <p className={`text-xl lg:text-2xl font-bold break-all ${
                    analytics.returnPercent >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analytics.returnPercent > 0 ? '+' : ''}{analytics.returnPercent.toFixed(2)}%
                  </p>
                  <p className={`text-sm mt-1 break-all ${
                    analytics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analytics.totalReturn > 0 ? '+' : ''}₩{analytics.totalReturn.toLocaleString()}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    📊 포트폴리오 현황
                  </h3>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                    {Array.isArray(holdings) ? holdings.length : 0}개 종목
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    다양성: {analytics.riskMetrics.diversificationScore}/100
                  </p>
                </div>
              </div>

              {/* 추가 성과 지표 - 6열 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    🎯 투자 성과
                  </h3>
                  <p className={`text-lg font-bold ${
                    analytics.returnPercent >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analytics.returnPercent >= 0 ? '수익' : '손실'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    승률: {analytics.performance.winRate.toFixed(1)}%
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    ⚡ 샤프 비율
                  </h3>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {analytics.riskMetrics.sharpeRatio}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    위험 대비 수익
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    📉 베타 (β)
                  </h3>
                  <p className={`text-lg font-bold ${
                    analytics.riskMetrics.beta > 1 ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    {analytics.riskMetrics.beta}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {analytics.riskMetrics.beta > 1 ? '공격적' : '보수적'}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    💰 일일 손익
                  </h3>
                  <p className={`text-lg font-bold break-all ${
                    (analytics.totalValue * 0.001) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(analytics.totalValue * 0.001) > 0 ? '+' : ''}₩{Math.round(analytics.totalValue * 0.001).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    전일 대비 추정
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    📊 최대 낙폭
                  </h3>
                  <p className="text-lg font-bold text-red-600">
                    {analytics.riskMetrics.maxDrawdown}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    최대 손실 구간
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    ⚡ 변동성
                  </h3>
                  <p className={`text-lg font-bold ${
                    analytics.riskMetrics.volatility > 30 ? 'text-red-600' : 
                    analytics.riskMetrics.volatility > 20 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {analytics.riskMetrics.volatility}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {analytics.riskMetrics.volatility > 30 ? '높음' : 
                     analytics.riskMetrics.volatility > 20 ? '보통' : '낮음'}
                  </p>
                </div>
              </div>

              {/* 섹터 분석 및 리스크 분석 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    🏢 섹터별 배분
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(analytics.sectorAllocation).map(([sector, percentage]) => (
                      <div key={sector} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {sector}
                        </span>
                        <div className="flex items-center">
                          <div className="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-3">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    ⚖️ 리스크 분석
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">베타 계수</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {analytics.riskMetrics.beta}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">최대 낙폭</span>
                      <span className="font-medium text-red-600">
                        {analytics.riskMetrics.maxDrawdown}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">다양성 점수</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {analytics.riskMetrics.diversificationScore}/100
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">승률</span>
                      <span className="font-medium text-green-600">
                        {analytics.performance.winRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 수익률 상위 종목 및 시장 비교 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      🏆 수익률 상위 종목
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {analytics.topPerformers.map((stock, index) => (
                        <div key={stock.stockCode} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mr-3">
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                {index + 1}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {stock.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {stock.stockCode}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${
                              stock.returnPercent >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {stock.returnPercent > 0 ? '+' : ''}{stock.returnPercent.toFixed(2)}%
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                              ₩{stock.value.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      📊 시장 대비 성과
                    </h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        내 포트폴리오
                      </p>
                      <p className={`text-2xl font-bold break-all ${
                        analytics.returnPercent >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {analytics.returnPercent > 0 ? '+' : ''}{analytics.returnPercent.toFixed(2)}%
                      </p>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          KOSPI 대비
                        </p>
                        <p className={`text-xl font-bold ${
                          analytics.performance.kospiComparison >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {analytics.performance.kospiComparison > 0 ? '+' : ''}
                          {analytics.performance.kospiComparison.toFixed(2)}%
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {analytics.performance.kospiComparison >= 0 ? '시장 대비 우수' : '시장 대비 부진'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 계좌별 현황 */}
              {accounts.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    💼 계좌별 현황
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map((account) => {
                      const accountHoldings = holdings.filter(h => h.account.id === account.id);
                      const accountValue = accountHoldings.reduce((sum, h) => sum + (h.totalValueKRW || 0), 0);
                      const accountInvestment = accountHoldings.reduce((sum, h) => sum + (h.totalInvestmentKRW || 0), 0);
                      const accountProfitLoss = accountValue - accountInvestment;
                      const accountProfitLossPercentage = accountInvestment > 0 ? (accountProfitLoss / accountInvestment) * 100 : 0;

                      return (
                        <div key={account.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                            {getAccountDisplayName(account)}
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">종목 수:</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {accountHoldings.length}개
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">평가금액:</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                ₩{accountValue.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">손익:</span>
                              <span className={`font-medium ${
                                accountProfitLoss >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                              }`}>
                                {accountProfitLoss >= 0 ? '+' : ''}₩{accountProfitLoss.toLocaleString()}
                                ({accountProfitLossPercentage.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  분석할 보유종목이 없습니다
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  보유종목을 먼저 등록해주세요.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/holdings')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    보유종목 관리로 이동
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
