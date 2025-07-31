// 사용자 관련 타입
export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// 증권사 관련 타입
export interface Broker {
  id: string;
  name: string;
  contactNumber?: string;
  websiteUrl?: string;
  createdAt: Date;
}

// 계좌 관련 타입
export interface Account {
  id: string;
  userId: string;
  brokerId: string;
  accountNumber: string;
  accountType: string;
  createdAt: Date;
  broker?: Broker;
  holdings?: Holding[];
  transactions?: Transaction[];
}

// 보유종목 관련 타입
export interface Holding {
  id: string;
  accountId: string;
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  updatedAt: Date;
  account?: Account;
}

// 거래내역 관련 타입
export interface Transaction {
  id: string;
  accountId: string;
  stockCode: string;
  stockName: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fees?: number;
  transactionDate: Date;
  createdAt: Date;
  account?: Account;
}

// 포트폴리오 요약 타입
export interface PortfolioSummary {
  totalValue: number;
  totalInvestment: number;
  totalProfit: number;
  profitRate: number;
  holdingsCount: number;
  accountsCount: number;
}

// 종목별 수익률 타입
export interface StockPerformance {
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investmentAmount: number;
  currentValue: number;
  profit: number;
  profitRate: number;
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 차트 데이터 타입
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

// 주식 시세 정보 타입 (외부 API)
export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

// 폼 입력 타입들
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AccountForm {
  brokerId: string;
  accountNumber: string;
  accountType: string;
}

export interface TransactionForm {
  accountId: string;
  stockCode: string;
  stockName: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fees?: number;
  transactionDate: string;
}
