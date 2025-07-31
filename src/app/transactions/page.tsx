'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';

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

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'BUY' | 'SELL';
  date: string;
  stockCode?: string;
  stockName?: string;
  quantity?: number;
  price?: number;
  amount: number;
  currency: string;
  fee?: number;
  description?: string;
  account: Account;
  createdAt: string;
}

interface Stock {
  id: string;
  stockCode: string;
  stockName: string;
  market: string;
  currency: string;
  currentPrice?: number;
}

interface Holding {
  id: string;
  stock: Stock;
  quantity: number;
  averagePrice: number;
  totalAmount: number;
  account: Account;
}

type TransactionType = Transaction['type'];

const TRANSACTION_TYPES: { value: TransactionType; label: string; icon: string; color: string }[] = [
  { value: 'DEPOSIT', label: '입금', icon: '💰', color: 'green' },
  { value: 'WITHDRAWAL', label: '출금', icon: '💸', color: 'red' },
  { value: 'DIVIDEND', label: '배당금', icon: '💎', color: 'purple' },
  { value: 'BUY', label: '매수', icon: '📈', color: 'blue' },
  { value: 'SELL', label: '매도', icon: '📉', color: 'orange' }
];

export default function TransactionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [availableStocks, setAvailableStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // 필터 상태
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedType, setSelectedType] = useState<TransactionType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 폼 상태
  const [formData, setFormData] = useState({
    type: 'DEPOSIT' as TransactionType,
    date: new Date().toISOString().split('T')[0],
    accountId: '',
    stockCode: '',
    stockName: '',
    quantity: '',
    price: '',
    amount: '',
    currency: 'KRW',
    fee: '',
    description: ''
  });

  // 종목 선택 상태
  const [showStockDropdown, setShowStockDropdown] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const [userResponse, transactionsResponse, accountsResponse, holdingsResponse] = await Promise.all([
        fetch('/api/user/me'),
        fetch('/api/transactions'),
        fetch('/api/accounts'),
        fetch('/api/holdings')
      ]);

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData.user);
      } else {
        router.push('/login');
        return;
      }

      if (transactionsResponse.ok) {
        const data = await transactionsResponse.json();
        setTransactions(data.transactions || []);
      }

      if (accountsResponse.ok) {
        const data = await accountsResponse.json();
        setAccounts(data.accounts || []);
        if (data.accounts?.length > 0 && !formData.accountId) {
          setFormData(prev => ({ ...prev, accountId: data.accounts[0].id }));
        }
      }

      if (holdingsResponse.ok) {
        const data = await holdingsResponse.json();
        setHoldings(data.holdings || []);
        
        // 보유종목에서 고유한 종목 목록 추출
        const uniqueStocks = Array.from(
          new Map(
            (data.holdings || []).map((holding: Holding) => [
              holding.stock.stockCode,
              holding.stock
            ])
          ).values()
        ) as Stock[];
        setAvailableStocks(uniqueStocks);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [router, formData.accountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 필터된 거래내역
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesAccount = !selectedAccount || transaction.account.id === selectedAccount;
      const matchesType = !selectedType || transaction.type === selectedType;
      const matchesDateFrom = !dateFrom || transaction.date >= dateFrom;
      const matchesDateTo = !dateTo || transaction.date <= dateTo;
      const matchesSearch = !searchTerm || 
        (transaction.stockName && transaction.stockName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (transaction.stockCode && transaction.stockCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (transaction.description && transaction.description.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesAccount && matchesType && matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [transactions, selectedAccount, selectedType, dateFrom, dateTo, searchTerm]);

  // 거래내역 통계
  const transactionStats = useMemo(() => {
    const stats = {
      totalDeposit: 0,
      totalWithdrawal: 0,
      totalDividend: 0,
      totalBuyAmount: 0,
      totalSellAmount: 0,
      transactionCount: filteredTransactions.length
    };

    filteredTransactions.forEach(transaction => {
      const amountKRW = transaction.currency === 'USD' ? transaction.amount * 1300 : transaction.amount;
      
      switch (transaction.type) {
        case 'DEPOSIT':
          stats.totalDeposit += amountKRW;
          break;
        case 'WITHDRAWAL':
          stats.totalWithdrawal += amountKRW;
          break;
        case 'DIVIDEND':
          stats.totalDividend += amountKRW;
          break;
        case 'BUY':
          stats.totalBuyAmount += amountKRW;
          break;
        case 'SELL':
          stats.totalSellAmount += amountKRW;
          break;
      }
    });

    return stats;
  }, [filteredTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError('');

      // 폼 데이터 검증
      if (!formData.accountId) {
        setError('계좌를 선택해주세요.');
        return;
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setError('금액을 올바르게 입력해주세요.');
        return;
      }

      if ((formData.type === 'BUY' || formData.type === 'SELL') && !formData.stockCode) {
        setError('종목 코드를 입력해주세요.');
        return;
      }

      if ((formData.type === 'BUY' || formData.type === 'SELL') && (!formData.quantity || !formData.price)) {
        setError('수량과 가격을 입력해주세요.');
        return;
      }

      const transactionData = {
        type: formData.type,
        date: formData.date,
        accountId: formData.accountId,
        stockCode: formData.stockCode || undefined,
        stockName: formData.stockName || undefined,
        quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        fee: formData.fee ? parseFloat(formData.fee) : undefined,
        description: formData.description || undefined
      };

      const url = editingTransaction ? `/api/transactions/${editingTransaction.id}` : '/api/transactions';
      const method = editingTransaction ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (response.ok) {
        await fetchData();
        resetForm();
        setShowForm(false);
        setEditingTransaction(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '거래내역 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save transaction:', error);
      setError('거래내역 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      date: transaction.date,
      accountId: transaction.account.id,
      stockCode: transaction.stockCode || '',
      stockName: transaction.stockName || '',
      quantity: transaction.quantity?.toString() || '',
      price: transaction.price?.toString() || '',
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      fee: transaction.fee?.toString() || '',
      description: transaction.description || ''
    });
    setShowStockDropdown(false);
    setStockSearchTerm('');
    setShowForm(true);
  };

  const handleDelete = async (transactionId: string) => {
    if (!confirm('이 거래내역을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      } else {
        setError('거래내역 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      setError('거래내역 삭제에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'DEPOSIT',
      date: new Date().toISOString().split('T')[0],
      accountId: accounts.length > 0 ? accounts[0].id : '',
      stockCode: '',
      stockName: '',
      quantity: '',
      price: '',
      amount: '',
      currency: 'KRW',
      fee: '',
      description: ''
    });
    setShowStockDropdown(false);
    setStockSearchTerm('');
  };

  const getTransactionTypeInfo = (type: TransactionType) => {
    return TRANSACTION_TYPES.find(t => t.value === type) || TRANSACTION_TYPES[0];
  };

  const getAccountDisplayName = (account: Account) => {
    if (account.nickname) {
      return `${account.nickname} (${account.institution.name})`;
    }
    const maskedAccountNumber = account.accountNumber.length > 8 
      ? `${account.accountNumber.slice(0, 4)}****${account.accountNumber.slice(-4)}`
      : account.accountNumber;
    return `${account.institution.name} - ${maskedAccountNumber}`;
  };

  const formatAmount = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : '₩';
    return `${symbol}${amount.toLocaleString()}`;
  };

  // 종목 검색 결과 필터링
  const filteredStocks = useMemo(() => {
    if (!stockSearchTerm) return availableStocks;
    const searchLower = stockSearchTerm.toLowerCase();
    return availableStocks.filter(stock => 
      stock.stockCode.toLowerCase().includes(searchLower) ||
      stock.stockName.toLowerCase().includes(searchLower)
    );
  }, [availableStocks, stockSearchTerm]);

  // 종목 선택 핸들러
  const handleStockSelect = (stock: Stock) => {
    setFormData(prev => ({
      ...prev,
      stockCode: stock.stockCode,
      stockName: stock.stockName,
      currency: stock.currency
    }));
    setShowStockDropdown(false);
    setStockSearchTerm('');
  };

  // 종목 코드 직접 입력 핸들러
  const handleStockCodeChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setFormData(prev => ({ ...prev, stockCode: upperValue }));
    setStockSearchTerm(upperValue);
    
    // 입력한 코드가 기존 종목과 일치하는지 확인
    const matchingStock = availableStocks.find(stock => stock.stockCode === upperValue);
    if (matchingStock) {
      setFormData(prev => ({
        ...prev,
        stockCode: matchingStock.stockCode,
        stockName: matchingStock.stockName,
        currency: matchingStock.currency
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-700 dark:text-gray-300">거래내역을 불러오는 중...</span>
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
          <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">거래내역 관리</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">입출금, 배당금, 매수/매도 내역 관리</span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => {
                  resetForm();
                  setEditingTransaction(null);
                  setShowForm(!showForm);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                거래내역 등록
              </button>
            </div>
          </div>

          {/* 하이브리드 시스템 안내 */}
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">💡 스마트 포트폴리오 관리</h3>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  거래내역을 등록하면 <strong>보유종목이 자동으로 계산</strong>됩니다! 
                  매수/매도 시 평단가와 수량이 정확하게 업데이트되며, 실현손익도 자동 추적됩니다.
                </p>
                <div className="mt-2 flex items-center space-x-4 text-xs text-blue-600 dark:text-blue-400">
                  <span>✅ 자동 평단가 계산</span>
                  <span>✅ 실현손익 추적</span>
                  <span>✅ 세무자료 생성</span>
                  <a href="/holdings" className="underline hover:no-underline">보유종목 확인하기 →</a>
                </div>
              </div>
            </div>
          </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <span className="text-red-800 dark:text-red-200">{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* 거래내역 통계 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full mr-3">
                <span className="text-lg">💰</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">총 입금</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">₩{transactionStats.totalDeposit.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full mr-3">
                <span className="text-lg">💸</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">총 출금</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">₩{transactionStats.totalWithdrawal.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full mr-3">
                <span className="text-lg">💎</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">총 배당금</p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">₩{transactionStats.totalDividend.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mr-3">
                <span className="text-lg">📈</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">총 매수금액</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">₩{transactionStats.totalBuyAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full mr-3">
                <span className="text-lg">📉</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">총 매도금액</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">₩{transactionStats.totalSellAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full mr-3">
                <span className="text-lg">📝</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">거래 건수</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{transactionStats.transactionCount}건</p>
              </div>
            </div>
          </div>
        </div>

        {/* 거래내역 등록 폼 */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingTransaction ? '거래내역 수정' : '거래내역 등록'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingTransaction(null);
                  resetForm();
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">거래 유형</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as TransactionType }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {TRANSACTION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">거래 날짜</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">계좌</label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">계좌 선택</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {getAccountDisplayName(account)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(formData.type === 'BUY' || formData.type === 'SELL' || formData.type === 'DIVIDEND') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      종목 코드 {formData.type === 'DIVIDEND' && <span className="text-gray-500 dark:text-gray-400">(선택)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.stockCode}
                        onChange={(e) => {
                          handleStockCodeChange(e.target.value);
                          setShowStockDropdown(e.target.value.length > 0 || availableStocks.length > 0);
                        }}
                        onFocus={() => setShowStockDropdown(true)}
                        onBlur={(e) => {
                          // 드롭다운 내부 요소 클릭 시 닫히지 않도록 지연
                          setTimeout(() => {
                            if (!e.relatedTarget?.closest('.stock-dropdown')) {
                              setShowStockDropdown(false);
                            }
                          }, 150);
                        }}
                        placeholder="예: AAPL, 005930 또는 검색"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                        required={formData.type === 'BUY' || formData.type === 'SELL'}
                      />
                      {availableStocks.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowStockDropdown(!showStockDropdown);
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <svg 
                            className={`h-5 w-5 transition-transform duration-200 ${showStockDropdown ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    {/* 종목 드롭다운 */}
                    {showStockDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-500 rounded-md shadow-lg max-h-60 overflow-y-auto stock-dropdown">
                        {availableStocks.length > 0 && (
                          <div className="p-2 border-b border-gray-200 dark:border-gray-500 bg-gray-50 dark:bg-gray-800">
                            <input
                              type="text"
                              value={stockSearchTerm}
                              onChange={(e) => setStockSearchTerm(e.target.value)}
                              placeholder="종목명 또는 코드로 검색..."
                              className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoComplete="off"
                            />
                          </div>
                        )}
                        <div className="max-h-48 overflow-y-auto">
                          {availableStocks.length > 0 ? (
                            filteredStocks.length > 0 ? (
                              filteredStocks.map((stock) => (
                                <button
                                  key={stock.id}
                                  type="button"
                                  onClick={() => handleStockSelect(stock)}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 focus:bg-gray-100 dark:focus:bg-gray-600 focus:outline-none"
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white">{stock.stockName}</div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">{stock.stockCode} • {stock.market}</div>
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 uppercase">{stock.currency}</div>
                                  </div>
                                </button>
                              ))
                            ) : stockSearchTerm ? (
                              <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                                &ldquo;{stockSearchTerm}&rdquo;에 해당하는 종목이 없습니다
                              </div>
                            ) : null
                          ) : (
                            <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                              보유종목이 없습니다. 종목 코드를 직접 입력해주세요.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      종목명 {formData.type === 'DIVIDEND' && <span className="text-gray-500 dark:text-gray-400">(선택)</span>}
                    </label>
                    <input
                      type="text"
                      value={formData.stockName}
                      onChange={(e) => setFormData(prev => ({ ...prev, stockName: e.target.value }))}
                      placeholder="자동 입력 또는 직접 입력"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      readOnly={availableStocks.some(stock => stock.stockCode === formData.stockCode)}
                    />
                    {formData.stockCode && !formData.stockName && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        💡 보유종목에 없는 종목입니다. 종목명을 직접 입력해주세요.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 외부 클릭시 드롭다운 닫기 */}
              {showStockDropdown && (
                <div
                  className="fixed inset-0 z-5"
                  onClick={() => {
                    setShowStockDropdown(false);
                    setStockSearchTerm('');
                  }}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(formData.type === 'BUY' || formData.type === 'SELL') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">수량</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">단가</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => {
                          const price = e.target.value;
                          const quantity = formData.quantity;
                          const totalAmount = price && quantity ? (parseFloat(price) * parseInt(quantity)).toString() : '';
                          setFormData(prev => ({ 
                            ...prev, 
                            price,
                            amount: totalAmount 
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {(formData.type === 'BUY' || formData.type === 'SELL') ? '총 금액' : '금액'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    readOnly={formData.type === 'BUY' || formData.type === 'SELL'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">통화</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="KRW">KRW (원)</option>
                    <option value="USD">USD (달러)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">수수료 (선택)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fee}
                    onChange={(e) => setFormData(prev => ({ ...prev, fee: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">메모 (선택)</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="거래에 대한 메모를 입력하세요"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTransaction(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-500 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? '저장 중...' : (editingTransaction ? '수정' : '등록')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 필터 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">계좌</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 계좌</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {getAccountDisplayName(account)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">거래 유형</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as TransactionType | '')}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 유형</option>
                {TRANSACTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">시작 날짜</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">종료 날짜</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">검색</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="종목명, 종목코드, 메모"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 거래내역 테이블 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-500 bg-gray-50 dark:bg-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              거래내역 ({filteredTransactions.length}건)
            </h3>
          </div>

          {filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">거래일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">유형</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">종목</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">수량/단가</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">금액</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">계좌</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">메모</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">액션</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTransactions.map((transaction) => {
                    const typeInfo = getTransactionTypeInfo(transaction.type);
                    return (
                      <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {new Date(transaction.date).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${typeInfo.color}-100 dark:bg-${typeInfo.color}-900/30 text-${typeInfo.color}-800 dark:text-${typeInfo.color}-200`}>
                            {typeInfo.icon} {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {transaction.stockName && transaction.stockCode ? (
                            <div>
                              <div className="font-medium">{transaction.stockName}</div>
                              <div className="text-gray-500 dark:text-gray-400">{transaction.stockCode}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {transaction.quantity && transaction.price ? (
                            <div>
                              <div>{transaction.quantity.toLocaleString()}주</div>
                              <div className="text-gray-500 dark:text-gray-400">{formatAmount(transaction.price, transaction.currency)}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatAmount(transaction.amount, transaction.currency)}
                          </div>
                          {transaction.fee && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              수수료: {formatAmount(transaction.fee, transaction.currency)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {getAccountDisplayName(transaction.account)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {transaction.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(transaction)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(transaction.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <svg className="h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">거래내역이 없습니다</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                첫 번째 거래내역을 등록해보세요.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                거래내역 등록하기
              </button>
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
