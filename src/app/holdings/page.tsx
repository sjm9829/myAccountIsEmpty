'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { useRealTimeStockData } from '@/hooks/useRealTimeStockData';

interface Institution {
  id: string;
  name: string;
}

interface Account {
  id: string;
  institution: Institution;
  accountNumber: string;
  accountType: string;
  nickname?: string;
}

interface Holding {
  id: string;
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: number;
  currency?: string;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  account: Account;
}

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [error, setError] = useState('');
  const [dataError, setDataError] = useState(''); // 데이터 로딩 에러
  const [isManualRefreshing, setIsManualRefreshing] = useState(false); // 수동 갱신 중 상태
  const [lastManualRefresh, setLastManualRefresh] = useState<Date | null>(null); // 마지막 수동 갱신 시간
  const [isRecalculating, setIsRecalculating] = useState(false); // 재계산 중 상태
  const [showHybridOptions, setShowHybridOptions] = useState(false); // 하이브리드 옵션 표시
  const [isSubmitting, setIsSubmitting] = useState(false); // 추가/수정 중 상태
  const [deletingId, setDeletingId] = useState<string | null>(null); // 삭제 중인 항목 ID
  const [formData, setFormData] = useState({
    accountId: '',
    stockCode: '',
    stockName: '',
    quantity: '',
    averagePrice: '',
    currency: 'KRW',
  });
  const router = useRouter();

  // 계좌 표시명 생성 함수
  const getAccountDisplayName = useCallback((account: Account) => {
    const nickname = account.nickname ? `${account.nickname}` : '';
    const institution = account.institution.name;
    const accountNumber = account.accountNumber;
    
    if (nickname) {
      return `${nickname} (${institution})`;
    }
    
    // 계좌번호가 길 경우 앞부분만 표시하고 뒷부분은 마스킹
    const maskedAccountNumber = accountNumber.length > 8 
      ? `${accountNumber.slice(0, 4)}****${accountNumber.slice(-4)}`
      : accountNumber;
    
    return `${institution} - ${maskedAccountNumber}`;
  }, []);

  // 계좌 툴팁 생성 함수 (전체 정보 표시용)
  const getAccountTooltip = (account: Account) => {
    const parts = [];
    if (account.nickname) parts.push(`별명: ${account.nickname}`);
    parts.push(`기관: ${account.institution.name}`);
    parts.push(`계좌: ${account.accountNumber}`);
    parts.push(`유형: ${account.accountType}`);
    return parts.join('\n');
  };

  // 보유 종목들의 심볼 추출 (중복 제거)
  const holdingSymbols = holdings.map(holding => holding.stockCode);

  // 실시간 주가 데이터 (모든 보유종목에 대해 가져오기)
  const { 
    stockData: realTimeData, 
    lastUpdate: stockLastUpdate,
    refreshData: refreshStockData,
    isLoading: isStockDataLoading,
    timeUntilNextUpdate
  } = useRealTimeStockData({
    symbols: holdingSymbols, // 모든 보유종목
    intervalMs: 180000, // 3분마다 업데이트
    enabled: holdingSymbols.length > 0
  });

  // 모든 보유종목에 대한 실시간 데이터 (테이블용 - realTimeData와 동일)
  const allRealTimeData = realTimeData;

  // 수동 갱신 가능 여부 확인 (1분 제한)
  const canManualRefresh = !lastManualRefresh || (Date.now() - lastManualRefresh.getTime()) >= 60000;

  // 수동 갱신 함수
  const handleManualRefresh = async () => {
    if (!canManualRefresh || isManualRefreshing) return;
    
    setIsManualRefreshing(true);
    setLastManualRefresh(new Date());
    
    try {
      await refreshStockData();
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // 거래내역 기반 재계산 함수
  const handleRecalculateFromTransactions = async () => {
    if (isRecalculating) return;
    
    const confirmed = window.confirm(
      '거래내역을 기반으로 보유종목을 재계산하시겠습니까?\n\n' +
      '⚠️ 주의사항:\n' +
      '• 현재 직접 입력한 보유종목 데이터가 모두 삭제됩니다\n' +
      '• 거래내역에 있는 매수/매도만을 기반으로 계산됩니다\n' +
      '• 이 작업은 되돌릴 수 없습니다'
    );
    
    if (!confirmed) return;
    
    setIsRecalculating(true);
    setError('');
    
    try {
      const response = await fetch('/api/portfolio/holdings/recalculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: selectedAccountId === 'all' ? null : selectedAccountId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`보유종목이 거래내역을 기반으로 재계산되었습니다.\n재계산된 종목 수: ${data.recalculatedCount}개`);
        await fetchHoldings();
      } else {
        const error = await response.json();
        setError(error.error || '재계산 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Recalculation failed:', error);
      setError('재계산 중 오류가 발생했습니다.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const fetchHoldings = useCallback(async () => {
    try {
      setDataError(''); // 에러 상태 초기화
      const url = selectedAccountId === 'all' 
        ? '/api/portfolio/holdings' 
        : `/api/portfolio/holdings?accountId=${selectedAccountId}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings);
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        setDataError('보유종목 데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch holdings:', error);
      setDataError('보유종목 데이터를 불러오는데 실패했습니다.');
    }
  }, [selectedAccountId, router]);

  const fetchAccounts = useCallback(async () => {
    try {
      setDataError(''); // 에러 상태 초기화
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts);
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        setDataError('계좌 정보를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      setDataError('계좌 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const loadData = async () => {
      await fetchAccounts();
      await fetchHoldings();
    };
    loadData();
  }, [fetchAccounts, fetchHoldings]);

  // 실시간 주가 데이터로 holdings 업데이트 및 정렬
  const updatedHoldings = holdings.map(holding => {
    const realtimePrice = allRealTimeData[holding.stockCode]; // 모든 실시간 데이터 사용
    if (realtimePrice) {
      const currentPrice = realtimePrice.regularMarketPrice;
      const totalValue = currentPrice * holding.quantity;
      const totalCost = holding.averagePrice * holding.quantity;
      const profitLoss = totalValue - totalCost;
      const profitLossPercentage = (profitLoss / totalCost) * 100;
      
      return {
        ...holding,
        currentPrice,
        totalValue,
        profitLoss,
        profitLossPercentage
      };
    }
    return holding;
  }).sort((a, b) => {
    // 계좌-통화-종목명 순으로 정렬
    const accountA = getAccountDisplayName(a.account);
    const accountB = getAccountDisplayName(b.account);
    if (accountA !== accountB) {
      return accountA.localeCompare(accountB);
    }
    
    // 2. 통화로 정렬 (KRW 먼저, USD 나중)
    const currencyA = a.currency || 'KRW';
    const currencyB = b.currency || 'KRW';
    if (currencyA !== currencyB) {
      if (currencyA === 'KRW' && currencyB === 'USD') return -1;
      if (currencyA === 'USD' && currencyB === 'KRW') return 1;
      return currencyA.localeCompare(currencyB);
    }
    
    // 3. 종목명으로 정렬
    return a.stockName.localeCompare(b.stockName);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.accountId || !formData.stockCode || !formData.stockName || 
        !formData.quantity || !formData.averagePrice) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    // 통화별 종목코드 형식 검증
    if (formData.currency === 'KRW') {
      // 한국 주식: 6자리 숫자 또는 M으로 시작하는 선물
      if (!/^(\d{6}|M\d{8})$/.test(formData.stockCode)) {
        setError('한국 종목코드는 6자리 숫자(예: 005930) 또는 M으로 시작하는 8자리 선물코드(예: M0402000)를 입력해주세요.');
        return;
      }
    } else if (formData.currency === 'USD') {
      // 미국 주식: 영문자로만 구성 (1-5글자)
      if (!/^[A-Z]{1,5}$/.test(formData.stockCode.toUpperCase())) {
        setError('미국 종목코드는 영문자만 입력해주세요 (예: AAPL, TSLA, MSFT).');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/portfolio/holdings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          stockCode: formData.currency === 'USD' ? formData.stockCode.toUpperCase() : formData.stockCode,
          quantity: parseInt(formData.quantity),
          averagePrice: parseFloat(formData.averagePrice),
        }),
      });

      if (response.ok) {
        await fetchHoldings();
        // 보유종목 추가 후 실시간 가격 정보 갱신
        setTimeout(async () => {
          try {
            await refreshStockData();
          } catch (error) {
            console.error('Failed to refresh stock data after adding holding:', error);
          }
        }, 1000); // 1초 후 실행 (서버에서 데이터 저장 완료 대기)
        
        setShowAddForm(false);
        setFormData({
          accountId: '',
          stockCode: '',
          stockName: '',
          quantity: '',
          averagePrice: '',
          currency: 'KRW',
        });
      } else {
        const data = await response.json();
        setError(data.error || '보유종목 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Holding creation error:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (holdingId: string) => {
    if (!confirm('정말로 이 보유종목을 삭제하시겠습니까?')) {
      return;
    }

    setDeletingId(holdingId);

    try {
      const response = await fetch(`/api/portfolio/holdings/${holdingId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchHoldings();
        // 보유종목 삭제 후 실시간 가격 정보 갱신 (남은 종목들만)
        setTimeout(async () => {
          try {
            await refreshStockData();
          } catch (error) {
            console.error('Failed to refresh stock data after deleting holding:', error);
          }
        }, 1000); // 1초 후 실행 (서버에서 데이터 삭제 완료 대기)
      } else {
        const data = await response.json();
        setError(data.error || '보유종목 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Holding deletion error:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (holding: Holding) => {
    setEditingHolding(holding);
    setFormData({
      accountId: holding.account.id,
      stockCode: holding.stockCode,
      stockName: holding.stockName,
      quantity: holding.quantity.toString(),
      averagePrice: holding.averagePrice.toString(),
      currency: holding.stockCode.match(/^\d{6}$|^M\d{8}$/) ? 'KRW' : 'USD', // 기존 종목코드 형식으로 통화 추정
    });
    setShowEditForm(true);
    setShowAddForm(false);
    setError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!editingHolding || !formData.accountId || !formData.stockCode || !formData.stockName || 
        !formData.quantity || !formData.averagePrice) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    // 통화별 종목코드 형식 검증
    if (formData.currency === 'KRW') {
      // 한국 주식: 6자리 숫자 또는 M으로 시작하는 선물
      if (!/^(\d{6}|M\d{8})$/.test(formData.stockCode)) {
        setError('한국 종목코드는 6자리 숫자(예: 005930) 또는 M으로 시작하는 8자리 선물코드(예: M0402000)를 입력해주세요.');
        return;
      }
    } else if (formData.currency === 'USD') {
      // 미국 주식: 영문자로만 구성 (1-5글자)
      if (!/^[A-Z]{1,5}$/.test(formData.stockCode.toUpperCase())) {
        setError('미국 종목코드는 영문자만 입력해주세요 (예: AAPL, TSLA, MSFT).');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/portfolio/holdings/${editingHolding.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          stockCode: formData.currency === 'USD' ? formData.stockCode.toUpperCase() : formData.stockCode,
          quantity: parseInt(formData.quantity),
          averagePrice: parseFloat(formData.averagePrice),
        }),
      });

      if (response.ok) {
        await fetchHoldings();
        // 보유종목 수정 후 실시간 가격 정보 갱신
        setTimeout(async () => {
          try {
            await refreshStockData();
          } catch (error) {
            console.error('Failed to refresh stock data after editing holding:', error);
          }
        }, 1000); // 1초 후 실행 (서버에서 데이터 수정 완료 대기)
        
        setShowEditForm(false);
        setEditingHolding(null);
        setFormData({
          accountId: '',
          stockCode: '',
          stockName: '',
          quantity: '',
          averagePrice: '',
          currency: 'KRW',
        });
      } else {
        const data = await response.json();
        setError(data.error || '보유종목 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Holding update error:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setShowEditForm(false);
    setEditingHolding(null);
    setFormData({
      accountId: '',
      stockCode: '',
      stockName: '',
      quantity: '',
      averagePrice: '',
      currency: 'KRW',
    });
    setError('');
  };

  const formatCurrencyByCurrency = (amount: number, currency: string = 'KRW') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    }
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatNumber = (number: number) => {
    return new Intl.NumberFormat('ko-KR').format(number);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-700 dark:text-gray-300">보유종목 데이터를 불러오는 중...</span>
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
          {/* 데이터 로딩 에러 알림 */}
          {dataError && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm text-red-800 dark:text-red-200">{dataError}</p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => {
                      setDataError('');
                      setIsLoading(true);
                      fetchAccounts();
                      fetchHoldings();
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 font-medium underline"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">보유종목 관리</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">종목 추가, 수정, 삭제</span>
            </div>
            
            {/* 컨트롤 버튼들 - 반응형 */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 sm:hidden">
                  계좌 필터
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-[200px] max-w-[300px] truncate"
                >
                  <option value="all">전체 계좌</option>
                  {accounts.map((account) => (
                    <option 
                      key={account.id} 
                      value={account.id}
                      title={getAccountTooltip(account)}
                    >
                      {getAccountDisplayName(account)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                {/* 하이브리드 옵션 토글 버튼 */}
                <button
                  onClick={() => setShowHybridOptions(!showHybridOptions)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  관리 옵션
                </button>
                
                <button
                  onClick={() => {
                    if (showEditForm) {
                      cancelEdit();
                    } else {
                      setShowAddForm(!showAddForm);
                      if (showAddForm) {
                        setFormData({
                          accountId: '',
                          stockCode: '',
                          stockName: '',
                          quantity: '',
                          averagePrice: '',
                          currency: 'KRW',
                        });
                        setError('');
                      }
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none"
                >
                  {showEditForm ? '취소' : (showAddForm ? '취소' : '종목 추가')}
                </button>
              </div>
            </div>
          </div>

          {/* 하이브리드 관리 옵션 패널 */}
          {showHybridOptions && (
            <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-start space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">하이브리드 관리 시스템</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    거래내역을 기반으로 자동 계산하거나, 직접 입력으로 관리할 수 있습니다.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 거래내역 기반 관리 */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="font-medium text-green-800 dark:text-green-300">거래내역 기반 (권장)</h4>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                    매수/매도 거래를 등록하면 보유종목이 자동으로 계산됩니다. 평단가와 실현손익 계산이 정확합니다.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={handleRecalculateFromTransactions}
                      disabled={isRecalculating}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      {isRecalculating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          재계산 중...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          거래내역에서 재계산
                        </>
                      )}
                    </button>
                    <a
                      href="/transactions"
                      className="w-full bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      거래내역 등록하기
                    </a>
                  </div>
                </div>

                {/* 직접 입력 관리 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <h4 className="font-medium text-blue-800 dark:text-blue-300">직접 입력</h4>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                    현재 보유 상황을 직접 입력합니다. 초기 설정이나 특별한 경우에 사용하세요.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setShowAddForm(true);
                        setShowHybridOptions(false);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      보유종목 직접 추가
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>권장사항:</strong> 거래내역을 통한 관리가 세무처리와 성과분석에 더 정확합니다. 
                    직접 입력은 초기 설정 시에만 사용하고, 이후에는 거래내역으로 관리하는 것을 권장합니다.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 종목 추가 폼 */}
          {showAddForm && !showEditForm && (
            <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">새 보유종목 추가</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      계좌 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.accountId}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    >
                      <option value="">계좌를 선택하세요</option>
                      {accounts.map((account) => (
                        <option 
                          key={account.id} 
                          value={account.id}
                          title={getAccountTooltip(account)}
                        >
                          {getAccountDisplayName(account)}
                        </option>
                      ))}
                    </select>
                    {accounts.length === 0 && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        계좌를 먼저 등록해주세요.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      통화
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => {
                        const currency = e.target.value as 'KRW' | 'USD';
                        setFormData(prev => ({ 
                          ...prev, 
                          currency,
                          stockCode: '', // 통화 변경 시 종목코드 초기화
                          stockName: ''  // 통화 변경 시 종목명도 초기화
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="KRW">한국 (KRW)</option>
                      <option value="USD">미국 (USD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      종목코드 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.stockCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, stockCode: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.currency === 'KRW' ? '005930' : 'AAPL'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      종목명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.stockName}
                      onChange={(e) => setFormData(prev => ({ ...prev, stockName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.currency === 'KRW' ? '삼성전자' : 'Apple Inc.'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      보유수량 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="10"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      평균단가 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.averagePrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, averagePrice: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="70000"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        추가 중...
                      </>
                    ) : (
                      '종목 추가'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 종목 수정 폼 */}
          {showEditForm && editingHolding && (
            <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">보유종목 수정</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      계좌 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.accountId}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    >
                      <option value="">계좌를 선택하세요</option>
                      {accounts.map((account) => (
                        <option 
                          key={account.id} 
                          value={account.id}
                          title={getAccountTooltip(account)}
                        >
                          {getAccountDisplayName(account)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      통화
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => {
                        const currency = e.target.value as 'KRW' | 'USD';
                        setFormData(prev => ({ 
                          ...prev, 
                          currency,
                          stockCode: '', // 통화 변경 시 종목코드 초기화
                          stockName: ''  // 통화 변경 시 종목명도 초기화
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="KRW">한국 (KRW)</option>
                      <option value="USD">미국 (USD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      종목코드 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.stockCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, stockCode: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.currency === 'KRW' ? '005930' : 'AAPL'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      종목명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.stockName}
                      onChange={(e) => setFormData(prev => ({ ...prev, stockName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.currency === 'KRW' ? '삼성전자' : 'Apple Inc.'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      보유수량 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="10"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      평균단가 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.averagePrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, averagePrice: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="70000"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSubmitting}
                    className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        수정 중...
                      </>
                    ) : (
                      '수정 완료'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* 보유종목 목록 */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">보유종목 목록</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    실시간 가격 정보 포함 • 총 {updatedHoldings.length}개 종목
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  {/* 실시간 업데이트 상태 */}
                  {stockLastUpdate && (
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        isStockDataLoading 
                          ? 'bg-yellow-500 animate-pulse' 
                          : 'bg-green-500'
                      }`} />
                      마지막 업데이트: {stockLastUpdate.toLocaleTimeString()}
                    </div>
                  )}

                  {/* 수동 갱신 버튼 */}
                  <button
                    onClick={handleManualRefresh}
                    disabled={!canManualRefresh || isManualRefreshing}
                    className={`inline-flex items-center justify-center p-2 rounded-md transition-colors ${
                      canManualRefresh && !isManualRefreshing
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    }`}
                    title={
                      isManualRefreshing
                        ? '주가 정보 갱신 중...'
                        : !canManualRefresh 
                        ? `1분 후 다시 시도 가능 (${Math.ceil((60000 - (Date.now() - (lastManualRefresh?.getTime() || 0))) / 1000)}초 남음)`
                        : '주가 정보 수동 갱신'
                    }
                  >
                    {isManualRefreshing ? (
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {/* 수동 갱신 제한 안내 */}
              {!canManualRefresh && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                  ⚠️ 수동 갱신은 1분에 1회만 가능합니다. {Math.ceil((60000 - (Date.now() - (lastManualRefresh?.getTime() || 0))) / 1000)}초 후 다시 시도하세요.
                </div>
              )}
            </div>
            
            {/* 데스크톱 테이블 */}
            <div className="hidden lg:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="w-1/4 px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        종목
                      </th>
                      <th className="w-1/6 px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        계좌
                      </th>
                      <th className="w-1/12 px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        보유수량
                      </th>
                      <th className="w-1/8 px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        평균단가
                      </th>
                      <th className="w-1/8 px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        현재가
                      </th>
                      <th className="w-1/8 px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        평가금액
                      </th>
                      <th className="w-1/8 px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        평가손익
                      </th>
                      <th className="w-1/12 px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        수익률
                      </th>
                      <th className="w-1/12 px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{updatedHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center">
                        <p className="text-gray-500 dark:text-gray-400">보유종목이 없습니다.</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                          위의 &apos;종목 추가&apos; 버튼을 클릭하여 보유종목을 추가해보세요.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    updatedHoldings.map((holding) => {
                      const isRealTimeUpdated = allRealTimeData[holding.stockCode];
                      return (
                        <tr key={holding.id}>
                          <td className="px-4 py-3 min-w-0 w-1/4">
                            <div className="flex items-start">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  <div 
                                    className="truncate cursor-help" 
                                    title={holding.stockName}
                                  >
                                    {holding.stockName}
                                  </div>
                                  <div className="flex items-center mt-1 space-x-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      holding.currency === 'USD' 
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                    }`}>
                                      {holding.currency || 'KRW'}
                                    </span>
                                    {isRealTimeUpdated && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        실시간
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={holding.stockCode}>
                                  {holding.stockCode}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 min-w-0">
                            <div className="text-sm text-gray-900 dark:text-white">
                              <div className="truncate cursor-help" title={getAccountDisplayName(holding.account)}>
                                {getAccountDisplayName(holding.account)}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <div className="truncate" title={holding.account.accountType}>
                                {holding.account.accountType}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                            {formatNumber(holding.quantity)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                            {formatCurrencyByCurrency(holding.averagePrice, holding.currency)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            <div className="flex flex-col items-end">
                              <span className={`font-medium ${
                                isRealTimeUpdated && allRealTimeData[holding.stockCode] && allRealTimeData[holding.stockCode].regularMarketChange !== 0
                                  ? allRealTimeData[holding.stockCode].regularMarketChange > 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-blue-600 dark:text-blue-400'
                                  : 'text-gray-900 dark:text-white'
                              }`}>
                                {formatCurrencyByCurrency(holding.currentPrice, holding.currency)}
                              </span>
                              {isRealTimeUpdated && allRealTimeData[holding.stockCode] && (
                                <span className={`text-xs ${
                                  allRealTimeData[holding.stockCode].regularMarketChange >= 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-blue-600 dark:text-blue-400'
                                }`}>
                                  {allRealTimeData[holding.stockCode].regularMarketChange >= 0 ? '+' : ''}
                                  {formatNumber(Math.round(allRealTimeData[holding.stockCode].regularMarketChange))}
                                  ({allRealTimeData[holding.stockCode].regularMarketChangePercent.toFixed(2)}%)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                            {formatCurrencyByCurrency(holding.totalValue, holding.currency)}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-medium ${
                            holding.profitLoss >= 0 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {formatCurrencyByCurrency(holding.profitLoss, holding.currency)}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-medium ${
                            holding.profitLossPercentage >= 0 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {holding.profitLossPercentage.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            <div className="flex flex-col items-center space-y-1">
                              <button
                                onClick={() => handleEdit(holding)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                title="수정"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(holding.id)}
                                disabled={deletingId === holding.id}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:text-gray-400 disabled:cursor-not-allowed p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:hover:bg-transparent"
                                title={deletingId === holding.id ? "삭제 중..." : "삭제"}
                              >
                                {deletingId === holding.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
            
            {/* 모바일 카드 형태 */}
            <div className="lg:hidden">
              {updatedHoldings.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">보유종목이 없습니다.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    위의 &apos;종목 추가&apos; 버튼을 클릭하여 보유종목을 추가해보세요.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {updatedHoldings.map((holding) => {
                    const isRealTimeUpdated = allRealTimeData[holding.stockCode];
                    return (
                      <div key={holding.id} className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {holding.stockName}
                              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                holding.currency === 'USD' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              }`}>
                                {holding.currency || 'KRW'}
                              </span>
                              {isRealTimeUpdated && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  실시간
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{holding.stockCode}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(holding)}
                              disabled={isSubmitting}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed font-medium text-sm"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(holding.id)}
                              disabled={deletingId === holding.id}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:text-gray-400 disabled:cursor-not-allowed font-medium text-sm flex items-center"
                            >
                              {deletingId === holding.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                                  삭제 중...
                                </>
                              ) : (
                                '삭제'
                              )}
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">수량</span>
                            <p className="font-medium text-gray-900 dark:text-white">{formatNumber(holding.quantity)}주</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">매입가</span>
                            <p className="font-medium text-gray-900 dark:text-white">{formatCurrencyByCurrency(holding.averagePrice, holding.currency)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">현재가</span>
                            <p className={`font-medium ${
                              isRealTimeUpdated && allRealTimeData[holding.stockCode] && allRealTimeData[holding.stockCode].regularMarketChange !== 0
                                ? allRealTimeData[holding.stockCode].regularMarketChange > 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {formatCurrencyByCurrency(holding.currentPrice, holding.currency)}
                            </p>
                            {isRealTimeUpdated && allRealTimeData[holding.stockCode] && (
                              <p className={`text-xs ${
                                allRealTimeData[holding.stockCode].regularMarketChange >= 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}>
                                {allRealTimeData[holding.stockCode].regularMarketChange >= 0 ? '+' : ''}
                                {formatNumber(Math.round(allRealTimeData[holding.stockCode].regularMarketChange))}
                                ({allRealTimeData[holding.stockCode].regularMarketChangePercent.toFixed(2)}%)
                              </p>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">평가금액</span>
                            <p className="font-medium text-gray-900 dark:text-white">{formatCurrencyByCurrency(holding.totalValue, holding.currency)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">평가손익</span>
                            <p className={`font-medium ${
                              holding.profitLoss >= 0 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {formatCurrencyByCurrency(holding.profitLoss, holding.currency)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">수익률</span>
                            <p className={`font-medium ${
                              holding.profitLossPercentage >= 0 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {holding.profitLossPercentage.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
