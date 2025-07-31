'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { portfolioStorage, PortfolioData } from '@/lib/localStorage';

interface PortfolioContextType {
  data: PortfolioData | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => void;
  addAccount: (account: Omit<PortfolioData['accounts'][0], 'id' | 'createdAt'>) => void;
  addTransaction: (transaction: Omit<PortfolioData['transactions'][0], 'id' | 'createdAt'>) => void;
  exportData: () => string;
  importData: (jsonData: string) => void;
  clearAllData: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

interface PortfolioProviderProps {
  children: ReactNode;
}

export function PortfolioProvider({ children }: PortfolioProviderProps) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  const loadData = () => {
    try {
      setIsLoading(true);
      setError(null);
      const portfolioData = portfolioStorage.loadData();
      setData(portfolioData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드에 실패했습니다.');
      console.error('Failed to load portfolio data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = () => {
    loadData();
  };

  const addAccount = (account: Omit<PortfolioData['accounts'][0], 'id' | 'createdAt'>) => {
    try {
      portfolioStorage.addAccount(account);
      loadData(); // 데이터 새로고침
    } catch (err) {
      setError(err instanceof Error ? err.message : '계좌 추가에 실패했습니다.');
    }
  };

  const addTransaction = (transaction: Omit<PortfolioData['transactions'][0], 'id' | 'createdAt'>) => {
    try {
      portfolioStorage.addTransaction(transaction);
      loadData(); // 데이터 새로고침
    } catch (err) {
      setError(err instanceof Error ? err.message : '거래 내역 추가에 실패했습니다.');
    }
  };

  const exportData = (): string => {
    try {
      return portfolioStorage.exportData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 내보내기에 실패했습니다.');
      return '';
    }
  };

  const importData = (jsonData: string) => {
    try {
      portfolioStorage.importData(jsonData);
      loadData(); // 데이터 새로고침
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 가져오기에 실패했습니다.');
    }
  };

  const clearAllData = () => {
    try {
      portfolioStorage.clearData();
      loadData(); // 데이터 새로고침
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 삭제에 실패했습니다.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const value: PortfolioContextType = {
    data,
    isLoading,
    error,
    refreshData,
    addAccount,
    addTransaction,
    exportData,
    importData,
    clearAllData,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
