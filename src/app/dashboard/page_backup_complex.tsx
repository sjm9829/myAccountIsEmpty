'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useRealTimeStockData } from '@/hooks/useRealTimeStockData';
import { isWeekend, getTodayLabel } from '@/utils/marketUtils';

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
  // 백업된 복잡한 대시보드 코드
  // ... (기존 코드가 여기에 들어갑니다)
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            복잡한 대시보드 (백업용)
          </h1>
          <p className="text-gray-600">
            이 파일은 기존 복잡한 대시보드의 백업입니다.
          </p>
          <Link 
            href="/dashboard" 
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            새로운 실시간 대시보드로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
