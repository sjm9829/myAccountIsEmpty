import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * 비밀번호를 해시화합니다
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

/**
 * 비밀번호를 검증합니다
 */
export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * JWT 토큰을 생성합니다
 */
export const generateToken = (payload: object): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

/**
 * JWT 토큰을 검증합니다
 */
export const verifyToken = (token: string): jwt.JwtPayload | string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.verify(token, secret);
};

/**
 * 수익률을 계산합니다
 */
export const calculateProfitRate = (
  currentValue: number,
  investmentAmount: number
): number => {
  if (investmentAmount === 0) return 0;
  return ((currentValue - investmentAmount) / investmentAmount) * 100;
};

/**
 * 숫자를 통화 형식으로 포맷합니다
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'KRW'
): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * 퍼센트를 포맷합니다
 */
export const formatPercent = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * 날짜를 포맷합니다
 */
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * 날짜와 시간을 포맷합니다
 */
export const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * 이메일 주소를 검증합니다
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 한국 주식 코드를 검증합니다 (6자리 숫자)
 */
export const isValidKoreanStockCode = (code: string): boolean => {
  const stockCodeRegex = /^\d{6}$/;
  return stockCodeRegex.test(code);
};

/**
 * 계좌번호를 마스킹합니다
 */
export const maskAccountNumber = (accountNumber: string): string => {
  if (accountNumber.length <= 4) return accountNumber;
  const visiblePart = accountNumber.slice(-4);
  const maskedPart = '*'.repeat(accountNumber.length - 4);
  return maskedPart + visiblePart;
};

/**
 * 평균 매수가를 계산합니다
 */
export const calculateAveragePrice = (
  currentQuantity: number,
  currentAveragePrice: number,
  newQuantity: number,
  newPrice: number
): number => {
  if (currentQuantity + newQuantity === 0) return 0;
  
  const totalValue = (currentQuantity * currentAveragePrice) + (newQuantity * newPrice);
  const totalQuantity = currentQuantity + newQuantity;
  
  return totalValue / totalQuantity;
};

/**
 * API 응답을 표준화합니다
 */
export const createApiResponse = <T>(
  success: boolean,
  data?: T,
  error?: string,
  message?: string
) => {
  return {
    success,
    data,
    error,
    message,
  };
};
