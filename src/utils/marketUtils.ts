/**
 * 시장 관련 유틸리티 함수들
 */

/**
 * 현재가 주말인지 확인 (토요일, 일요일)
 */
export function isWeekend(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0: 일요일, 6: 토요일
}

/**
 * 가장 최근 영업일 (금요일)을 반환
 * 주말이면 금요일을, 평일이면 현재 날짜를 반환
 */
export function getLastTradingDay(date: Date = new Date()): Date {
  const currentDate = new Date(date);
  
  if (!isWeekend(currentDate)) {
    return currentDate; // 평일이면 현재 날짜 반환
  }
  
  // 주말이면 가장 최근 금요일 찾기
  const day = currentDate.getDay();
  let daysToSubtract = 0;
  
  if (day === 0) { // 일요일
    daysToSubtract = 2;
  } else if (day === 6) { // 토요일
    daysToSubtract = 1;
  }
  
  const lastFriday = new Date(currentDate);
  lastFriday.setDate(currentDate.getDate() - daysToSubtract);
  
  return lastFriday;
}

/**
 * 한국 시장이 열려있는지 확인
 * 한국 시간 기준 9:00-15:30 (평일만)
 */
export function isKoreanMarketOpen(date: Date = new Date()): boolean {
  if (isWeekend(date)) {
    return false;
  }
  
  // 한국 시간으로 변환
  const koreaTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  const hours = koreaTime.getHours();
  const minutes = koreaTime.getMinutes();
  
  // 9:00 - 15:30 사이인지 확인
  const startTime = 9 * 60; // 9:00 in minutes
  const endTime = 15 * 60 + 30; // 15:30 in minutes
  const currentTime = hours * 60 + minutes;
  
  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * 미국 시장이 열려있는지 확인
 * 미국 동부 시간 기준 9:30-16:00 (평일만)
 */
export function isUSMarketOpen(date: Date = new Date()): boolean {
  if (isWeekend(date)) {
    return false;
  }
  
  // 미국 동부 시간으로 변환
  const usTime = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const hours = usTime.getHours();
  const minutes = usTime.getMinutes();
  
  // 9:30 - 16:00 사이인지 확인
  const startTime = 9 * 60 + 30; // 9:30 in minutes
  const endTime = 16 * 60; // 16:00 in minutes
  const currentTime = hours * 60 + minutes;
  
  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * 심볼이 한국 주식인지 확인
 */
export function isKoreanStock(symbol: string): boolean {
  return /^\d{6}$/.test(symbol);
}

/**
 * 심볼이 미국 주식인지 확인 (간단한 로직)
 */
export function isUSStock(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol) && !isKoreanStock(symbol);
}

/**
 * 주말인 경우 "오늘"이라는 표현을 "금요일 기준"으로 변경
 */
export function getTodayLabel(): string {
  if (isWeekend()) {
    const lastFriday = getLastTradingDay();
    return `금요일 기준 (${lastFriday.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })})`;
  }
  return "오늘";
}
