/**
 * 이전 영업일을 계산하는 유틸리티 함수
 */

// 한국 공휴일 목록 (간단한 버전 - 실제로는 더 복잡한 로직 필요)
const KOREAN_HOLIDAYS_2024 = [
  '2024-01-01', // 신정
  '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', // 설날
  '2024-03-01', // 삼일절
  '2024-05-05', // 어린이날
  '2024-05-15', // 부처님오신날
  '2024-06-06', // 현충일
  '2024-08-15', // 광복절
  '2024-09-16', '2024-09-17', '2024-09-18', // 추석
  '2024-10-03', '2024-10-09', // 개천절, 한글날
  '2024-12-25', // 성탄절
];

const KOREAN_HOLIDAYS_2025 = [
  '2025-01-01', // 신정
  '2025-01-28', '2025-01-29', '2025-01-30', // 설날
  '2025-03-01', // 삼일절
  '2025-05-05', // 어린이날
  '2025-05-12', // 부처님오신날
  '2025-06-06', // 현충일
  '2025-08-15', // 광복절
  '2025-10-03', '2025-10-06', '2025-10-07', '2025-10-08', // 개천절, 추석
  '2025-10-09', // 한글날
  '2025-12-25', // 성탄절
];

// 미국 공휴일 목록 (주요 휴장일)
const US_HOLIDAYS_2024 = [
  '2024-01-01', // New Year's Day
  '2024-01-15', // Martin Luther King Jr. Day
  '2024-02-19', // Presidents Day
  '2024-03-29', // Good Friday
  '2024-05-27', // Memorial Day
  '2024-06-19', // Juneteenth
  '2024-07-04', // Independence Day
  '2024-09-02', // Labor Day
  '2024-11-28', // Thanksgiving
  '2024-12-25', // Christmas
];

const US_HOLIDAYS_2025 = [
  '2025-01-01', // New Year's Day
  '2025-01-20', // Martin Luther King Jr. Day
  '2025-02-17', // Presidents Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
];

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 주말인지 확인
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * 한국 공휴일인지 확인
 */
function isKoreanHoliday(date: Date): boolean {
  const dateStr = formatDate(date);
  return KOREAN_HOLIDAYS_2024.includes(dateStr) || KOREAN_HOLIDAYS_2025.includes(dateStr);
}

/**
 * 미국 공휴일인지 확인
 */
function isUSHoliday(date: Date): boolean {
  const dateStr = formatDate(date);
  return US_HOLIDAYS_2024.includes(dateStr) || US_HOLIDAYS_2025.includes(dateStr);
}

/**
 * 한국 증시 영업일인지 확인
 */
function isKoreanTradingDay(date: Date): boolean {
  return !isWeekend(date) && !isKoreanHoliday(date);
}

/**
 * 미국 증시 영업일인지 확인
 */
function isUSTradingDay(date: Date): boolean {
  return !isWeekend(date) && !isUSHoliday(date);
}

/**
 * 이전 영업일을 계산 (한국 시장 기준)
 */
export function getPreviousKoreanTradingDay(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  date.setDate(date.getDate() - 1);
  
  while (!isKoreanTradingDay(date)) {
    date.setDate(date.getDate() - 1);
  }
  
  return date;
}

/**
 * 이전 영업일을 계산 (미국 시장 기준)
 */
export function getPreviousUSTradingDay(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  date.setDate(date.getDate() - 1);
  
  while (!isUSTradingDay(date)) {
    date.setDate(date.getDate() - 1);
  }
  
  return date;
}

/**
 * 심볼에 따라 적절한 이전 영업일을 계산
 */
export function getPreviousTradingDay(symbol: string, fromDate: Date = new Date()): Date {
  const isKoreanStock = /^\d{6}($|\.KS)/.test(symbol) || /^M\d{8}$/.test(symbol);
  
  if (isKoreanStock) {
    return getPreviousKoreanTradingDay(fromDate);
  } else {
    return getPreviousUSTradingDay(fromDate);
  }
}

/**
 * 현재 시간이 장 종료 후인지 확인
 */
export function isAfterMarketClose(symbol: string): boolean {
  const now = new Date();
  const isKoreanStock = /^\d{6}($|\.KS)/.test(symbol) || /^M\d{8}$/.test(symbol);
  
  console.log(`🕐 Checking market close for ${symbol}:`, {
    isKoreanStock,
    currentTime: now.toISOString(),
    currentLocalTime: now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  });
  
  if (isKoreanStock) {
    // 한국 시간으로 변환
    const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const hour = koreaTime.getHours();
    const minute = koreaTime.getMinutes();
    const dayOfWeek = koreaTime.getDay(); // 0: Sunday, 6: Saturday
    
    console.log(`🇰🇷 Korea time check:`, {
      hour,
      minute,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      timeCheck: hour > 15 || (hour === 15 && minute >= 30)
    });
    
    // 주말이거나 15:30 이후이면 장 종료 후
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isAfterClose = hour > 15 || (hour === 15 && minute >= 30);
    
    return isWeekend || isAfterClose;
  } else {
    // 미국 시간으로 변환
    const usTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = usTime.getHours();
    const dayOfWeek = usTime.getDay();
    
    console.log(`🇺🇸 US time check:`, {
      hour,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      timeCheck: hour >= 16
    });
    
    // 주말이거나 16:00 이후이면 장 종료 후
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isAfterClose = hour >= 16;
    
    return isWeekend || isAfterClose;
  }
}
