'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';

// 타입 정의
interface HoldingFromAPI {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  quantity: number;
  profitLoss: number;
  profitLossPercentage: number;
  dailyChangePercent?: number;
}

interface StockHolding {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  changePercent: number;
  quantity: number;
  profitLoss: number;
  profitLossPercent: number;
}

interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalInvestment: number;
  todayChange: number;
  todayChangePercent: number;
  totalProfit: number;
  totalProfitPercent: number;
}

interface NewsItem {
  id: string;
  type: 'news' | 'surge' | 'drop' | 'market';
  stockCode: string;
  stockName?: string;
  title: string;
  summary: string;
  changePercent?: number;
  timestamp: string;
  source?: string;
}

export default function RealTimeDashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isMarketOpen, setIsMarketOpen] = useState(true);

  // 실시간 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // 포트폴리오 요약 (holdings API의 summary 사용)
        console.log('Fetching portfolio summary from holdings API...');
        const holdingsRes = await fetch('/api/portfolio/holdings', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        console.log('Holdings response status:', holdingsRes.status);
        
        // 인증 실패 시 로그인 페이지로 리다이렉트
        if (holdingsRes.status === 401) {
          console.log('Authentication required, redirecting to login...');
          window.location.href = '/login';
          return;
        }
        
        if (holdingsRes.ok) {
          const holdingsData = await holdingsRes.json();
          console.log('Holdings full data:', holdingsData);
          
          // holdings API의 summary를 portfolio summary로 변환
          if (holdingsData.summary) {
            const summary = holdingsData.summary;
            
            const portfolioSummary = {
              totalValue: Math.round(summary.totalValue || 0),
              totalInvestment: Math.round(summary.totalInvestment || 0),
              todayChange: Math.round(summary.totalTodayChange || 0),
              todayChangePercent: Number((summary.totalTodayChangePercent || 0).toFixed(2)),
              totalProfit: Math.round(summary.totalProfitLoss || 0),
              totalProfitPercent: Number((summary.totalProfitLossPercentage || 0).toFixed(2))
            };
            console.log('Converted portfolio summary:', portfolioSummary);
            setPortfolio(portfolioSummary);
          }
          
          // 보유 종목 데이터도 같이 처리 (상위 6개만)
          const transformedHoldings = holdingsData.holdings?.slice(0, 6).map((holding: HoldingFromAPI) => ({
            stockCode: holding.stockCode,
            stockName: holding.stockName,
            currentPrice: holding.currentPrice || 0,
            changePercent: holding.dailyChangePercent || 0, // 전일 대비 등락률
            quantity: holding.quantity,
            profitLoss: holding.profitLoss || 0,
            profitLossPercent: holding.profitLossPercentage || 0,
          })) || [];
          
          setHoldings(transformedHoldings);
          
          // 실제 데이터 기반 새소식 생성
          const generatedNews: NewsItem[] = [];
          
          // 보유 종목 기반 뉴스 생성
          holdingsData.holdings?.forEach((holding: HoldingFromAPI) => {
            const profitPercent = holding.profitLossPercentage || 0;
            const dailyChange = holding.dailyChangePercent || 0;
            const stockName = holding.stockName || holding.stockCode;
            
            // 급등 뉴스 (일일 변동 +5% 이상)
            if (dailyChange >= 5) {
              generatedNews.push({
                id: `surge-${holding.stockCode}-${Date.now()}`,
                type: 'surge',
                stockCode: holding.stockCode,
                stockName: stockName,
                title: `${stockName} 급등`,
                summary: `전일 대비 ${dailyChange.toFixed(1)}% 상승하며 강세를 보이고 있습니다. 거래량 증가와 함께 투자자들의 관심이 집중되고 있습니다.`,
                changePercent: Number(dailyChange.toFixed(2)),
                timestamp: `${Math.floor(Math.random() * 30) + 1}분 전`,
                source: '시장 동향'
              });
            }
            
            // 급락 뉴스 (일일 변동 -4% 이하)
            else if (dailyChange <= -4) {
              generatedNews.push({
                id: `drop-${holding.stockCode}-${Date.now()}`,
                type: 'drop',
                stockCode: holding.stockCode,
                stockName: stockName,
                title: `${stockName} 급락`,
                summary: `전일 대비 ${Math.abs(dailyChange).toFixed(1)}% 하락세를 보이고 있습니다. 시장 상황을 주의 깊게 모니터링하시기 바랍니다.`,
                changePercent: Number(dailyChange.toFixed(2)),
                timestamp: `${Math.floor(Math.random() * 20) + 1}분 전`,
                source: '시장 경보'
              });
            }
            
            // 수익률 관련 뉴스
            if (profitPercent >= 15) {
              generatedNews.push({
                id: `profit-news-${holding.stockCode}-${Date.now()}`,
                type: 'news',
                stockCode: holding.stockCode,
                stockName: stockName,
                title: `${stockName} 투자 성과 우수`,
                summary: `현재 수익률 ${profitPercent.toFixed(1)}%를 기록하며 포트폴리오의 핵심 수익원으로 자리잡고 있습니다.`,
                changePercent: Number(profitPercent.toFixed(2)),
                timestamp: `${Math.floor(Math.random() * 60) + 1}분 전`,
                source: '포트폴리오 분석'
              });
            }
            
            // 손실 경고 뉴스
            else if (profitPercent <= -10) {
              generatedNews.push({
                id: `loss-news-${holding.stockCode}-${Date.now()}`,
                type: 'drop',
                stockCode: holding.stockCode,
                stockName: stockName,
                title: `${stockName} 손실 확대`,
                summary: `현재 손실률 ${Math.abs(profitPercent).toFixed(1)}%를 기록하고 있습니다. 추가 하락 위험을 고려한 전략 검토가 필요합니다.`,
                changePercent: Number(profitPercent.toFixed(2)),
                timestamp: `${Math.floor(Math.random() * 45) + 1}분 전`,
                source: '리스크 관리'
              });
            }
          });
          
          // 포트폴리오 전체 뉴스
          if (holdingsData.summary) {
            const todayChangePercent = holdingsData.summary.totalTodayChangePercent || 0;
            const totalProfitPercent = holdingsData.summary.totalProfitLossPercentage || 0;
            
            // 포트폴리오 급등/급락 뉴스
            if (Math.abs(todayChangePercent) >= 2) {
              generatedNews.push({
                id: `portfolio-move-${Date.now()}`,
                type: todayChangePercent >= 0 ? 'surge' : 'drop',
                stockCode: '포트폴리오',
                title: `포트폴리오 ${todayChangePercent >= 0 ? '상승' : '하락'} 동향`,
                summary: `전체 포트폴리오가 전일 대비 ${Math.abs(todayChangePercent).toFixed(2)}% ${todayChangePercent >= 0 ? '상승' : '하락'}했습니다. ${todayChangePercent >= 0 ? '시장 상승세에 따른 긍정적 흐름' : '시장 하락으로 인한 일시적 조정'}으로 보입니다.`,
                changePercent: Number(todayChangePercent.toFixed(2)),
                timestamp: '15분 전',
                source: '포트폴리오 현황'
              });
            }
            
            // 전체 수익률 달성 뉴스
            if (totalProfitPercent >= 10) {
              generatedNews.push({
                id: `portfolio-profit-${Date.now()}`,
                type: 'news',
                stockCode: '포트폴리오',
                title: '포트폴리오 수익률 목표 달성',
                summary: `전체 포트폴리오 수익률이 ${totalProfitPercent.toFixed(1)}%에 도달했습니다. 분산투자 전략이 효과적으로 작동하고 있습니다.`,
                changePercent: Number(totalProfitPercent.toFixed(2)),
                timestamp: '30분 전',
                source: '투자 성과'
              });
            }
          }
          
          // 시장 상황 뉴스
          const now = new Date();
          const hour = now.getHours();
          const minute = now.getMinutes();
          
          // 장 시작/마감 뉴스
          if (hour === 9 && minute <= 10) {
            generatedNews.push({
              id: `market-open-${Date.now()}`,
              type: 'market',
              stockCode: '시장',
              title: '한국 주식시장 개장',
              summary: '코스피, 코스닥 시장이 개장했습니다. 오늘의 시장 동향을 주의 깊게 관찰하시기 바랍니다.',
              timestamp: '방금',
              source: '시장 현황'
            });
          }
          
          if (hour === 15 && minute >= 20 && minute <= 35) {
            generatedNews.push({
              id: `market-close-${Date.now()}`,
              type: 'market',
              stockCode: '시장',
              title: '한국 주식시장 마감 임박',
              summary: '장 마감이 30분 앞으로 다가왔습니다. 마감 전 포지션 정리를 고려해보세요.',
              timestamp: '방금',
              source: '시장 현황'
            });
          }
          
          // 기본 뉴스 (뉴스가 없을 때)
          if (generatedNews.length === 0) {
            generatedNews.push({
              id: 'stable-market',
              type: 'news',
              stockCode: '시장',
              title: '시장 안정세 지속',
              summary: '보유 종목들이 안정적인 흐름을 보이고 있습니다. 큰 변동성 없이 정상적인 거래가 이루어지고 있습니다.',
              timestamp: '10분 전',
              source: '시장 동향'
            });
          }
          
          // 최신 뉴스 5개만 표시 (중요도 순으로 정렬)
          const sortedNews = generatedNews.sort((a, b) => {
            const typeOrder = { drop: 0, surge: 1, news: 2, market: 3 };
            return typeOrder[a.type] - typeOrder[b.type];
          }).slice(0, 5);
          
          setNews(sortedNews);
        } else {
          console.error('Holdings fetch failed:', holdingsRes.status, await holdingsRes.text());
        }

        // 시장 지수
        setMarketIndices([
          { name: 'KOSPI', value: 2580.50, change: 30.25, changePercent: 1.2 },
          { name: 'NASDAQ', value: 17190.13, change: 136.21, changePercent: 0.8 },
          { name: 'S&P500', value: 4567.89, change: 22.34, changePercent: 0.5 }
        ]);

        setLastUpdate(new Date());
      } catch (error) {
        console.error('데이터 로딩 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // 5분마다 실시간 업데이트
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  // 시장 상태 확인
  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const hour = now.getHours();
      // 한국시장: 9-18시, 미국시장: 22-6시 (한국시간)
      const koreanMarketOpen = hour >= 9 && hour < 18;
      const usMarketOpen = hour >= 22 || hour < 6;
      setIsMarketOpen(koreanMarketOpen || usMarketOpen);
    };

    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 300000); // 5분마다 확인
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">실시간 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 페이지 타이틀 영역 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                실시간 대시보드
              </h1>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isMarketOpen ? '시장 개장' : '시장 휴장'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <span>마지막 업데이트: {lastUpdate.toLocaleTimeString()}</span>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                새로고침
              </button>
            </div>
          </div>
        </div>
        {/* 1단계: 핵심 KPI 영역 (상단 30%) */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 총 자산 현황 - 새로운 컴팩트 디자인 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">총 자산</h2>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-white/80">실시간</span>
                  </div>
                </div>
              </div>
              
              {/* 메인 컨텐츠 */}
              <div className="p-6">
                {portfolio ? (
                  <div className="space-y-4">
                    {/* 총 자산 금액 */}
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        ₩{portfolio.totalValue.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        전체 포트폴리오 가치
                      </div>
                    </div>
                    
                    {/* 등락 정보 */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* 전일 대비 */}
                        <div className="text-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">전일 대비</div>
                          <div className={`text-lg font-bold ${
                            portfolio.todayChange >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {portfolio.todayChange >= 0 ? '+' : ''}₩{Math.abs(portfolio.todayChange).toLocaleString()}
                          </div>
                          <div className={`text-sm font-medium ${
                            portfolio.todayChangePercent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            ({portfolio.todayChangePercent >= 0 ? '+' : ''}{portfolio.todayChangePercent.toFixed(2)}%)
                          </div>
                        </div>
                        
                        {/* 총 수익 */}
                        <div className="text-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">총 수익</div>
                          <div className={`text-lg font-bold ${
                            portfolio.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {portfolio.totalProfit >= 0 ? '+' : ''}₩{Math.abs(portfolio.totalProfit).toLocaleString()}
                          </div>
                          <div className={`text-sm font-medium ${
                            portfolio.totalProfitPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            ({portfolio.totalProfitPercent >= 0 ? '+' : ''}{portfolio.totalProfitPercent.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 투자 원금 정보 */}
                    <div className="text-center pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        투자 원금: ₩{portfolio.totalInvestment.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">데이터 로딩 중...</div>
                  </div>
                )}
              </div>
            </div>

            {/* 새소식 센터 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">새소식</h2>
                      <div className="text-xs text-white/80">보유종목 및 시장 동향</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      news.some(item => item.type === 'drop') 
                        ? 'bg-red-100 text-red-700' 
                        : news.some(item => item.type === 'surge')
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {news.filter(item => item.type === 'drop').length > 0 && `급락 ${news.filter(item => item.type === 'drop').length}개`}
                      {news.filter(item => item.type === 'drop').length === 0 && news.filter(item => item.type === 'surge').length > 0 && `급등 ${news.filter(item => item.type === 'surge').length}개`}
                      {news.filter(item => item.type === 'drop').length === 0 && news.filter(item => item.type === 'surge').length === 0 && `뉴스 ${news.length}개`}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 뉴스 목록 */}
              <div className="p-6">
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {news.length > 0 ? news.map(item => (
                    <div 
                      key={item.id}
                      className={`group relative p-4 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer ${
                        item.type === 'drop' 
                          ? 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/10 dark:to-red-900/20 border-red-200 dark:border-red-800 hover:border-red-300' 
                          : item.type === 'surge'
                          ? 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/10 dark:to-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300'
                          : item.type === 'market'
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/10 dark:to-blue-900/20 border-blue-200 dark:border-blue-800 hover:border-blue-300'
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/10 dark:to-gray-900/20 border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        {/* 뉴스 아이콘 */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          item.type === 'drop' 
                            ? 'bg-red-500 text-white' 
                            : item.type === 'surge'
                            ? 'bg-green-500 text-white'
                            : item.type === 'market'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-500 text-white'
                        }`}>
                          {item.type === 'drop' && (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                            </svg>
                          )}
                          {item.type === 'surge' && (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          )}
                          {item.type === 'market' && (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          )}
                          {item.type === 'news' && (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* 헤더 */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className={`font-bold text-sm px-2 py-1 rounded-md ${
                                item.type === 'drop' 
                                  ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' 
                                  : item.type === 'surge'
                                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                  : item.type === 'market'
                                  ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                                  : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                              }`}>
                                {item.stockCode}
                              </span>
                              {item.source && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  {item.source}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {item.changePercent !== undefined && item.changePercent !== 0 && (
                                <div className={`inline-flex items-center space-x-1 text-xs font-bold px-2 py-1 rounded-md ${
                                  item.changePercent >= 0 
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                }`}>
                                  <span>{item.changePercent >= 0 ? '▲' : '▼'}</span>
                                  <span>{Math.abs(item.changePercent).toFixed(2)}%</span>
                                </div>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {item.timestamp}
                              </span>
                            </div>
                          </div>
                          
                          {/* 제목 */}
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.title}
                          </h3>
                          
                          {/* 요약 */}
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            {item.summary}
                          </p>
                        </div>
                      </div>
                      
                      {/* 호버 시 더보기 표시 */}
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <div className="bg-white dark:bg-gray-800 rounded-full p-1 shadow-md">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-sm">
                        현재 새소식이 없습니다
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        시장이 안정적으로 운영되고 있습니다
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 하단 카테고리 요약 */}
                {news.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                          {news.filter(item => item.type === 'drop').length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">급락</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {news.filter(item => item.type === 'surge').length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">급등</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {news.filter(item => item.type === 'market').length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">시장</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
                          {news.filter(item => item.type === 'news').length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">뉴스</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2단계: 실시간 모니터링 영역 (중간 40%) */}
        <div className="mb-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* 보유 종목 실시간 현황 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">보유 종목 현황</h2>
              </div>
              <div className="p-6">
                {holdings.length > 0 ? (
                  <div className="space-y-4">
                    {holdings.map((stock, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {stock.stockName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {stock.quantity}주 보유
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            ${(stock.currentPrice || 0).toFixed(2)}
                          </div>
                          <div className={`text-sm font-medium ${
                            (stock.changePercent || 0) >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {(stock.changePercent || 0) >= 0 ? '+' : ''}{(stock.changePercent || 0).toFixed(2)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${
                            (stock.profitLoss || 0) >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {(stock.profitLoss || 0) >= 0 ? '+' : ''}₩{Math.abs(stock.profitLoss || 0).toLocaleString()}
                          </div>
                          <div className={`text-sm ${
                            (stock.profitLossPercent || 0) >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            ({(stock.profitLossPercent || 0) >= 0 ? '+' : ''}{(stock.profitLossPercent || 0).toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    보유 종목이 없습니다
                  </div>
                )}
              </div>
            </div>

            {/* 시장 지수 현황 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">주요 지수</h2>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {marketIndices.map((index, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-lg">
                          {index.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900 dark:text-white text-lg">
                          {index.value.toLocaleString()}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${
                            index.changePercent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}
                          </span>
                          <span className={`text-sm font-medium ${
                            index.changePercent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3단계: 빠른 액션 영역 (하단 30%) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 오늘의 거래 요약 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">오늘의 거래</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">3</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">매수 완료</div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">1</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">매도 완료</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">₩250K</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">실현 손익</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">2</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">대기 주문</div>
              </div>
            </div>
          </div>

          {/* 빠른 액세스 버튼 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">빠른 액세스</h2>
            <div className="grid grid-cols-1 gap-3">
              <Link
                href="/transactions"
                className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                긴급 매도
              </Link>
              <Link
                href="/holdings"
                className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                포트폴리오 상세
              </Link>
              <Link
                href="/analytics"
                className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                상세 분석
              </Link>
            </div>
          </div>
        </div>

        {/* 빠른 새로고침 버튼 */}
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-colors"
            title="새로고침"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
