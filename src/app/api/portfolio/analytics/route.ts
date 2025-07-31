import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface PortfolioAnalytics {
  totalValue: number;
  totalInvestment: number;
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  volatility: number;
  maxDrawdown: number;
  diversificationScore: number;
  sectorAllocation: { [key: string]: number };
  riskMetrics: {
    var95: number; // Value at Risk (95%)
    beta: number;
    alpha: number;
  };
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
}

// 섹터 분류 (간단한 예시)
const SECTOR_MAPPING: { [key: string]: string } = {
  '005930': '반도체',
  '000660': '반도체',
  '035420': 'IT서비스',
  '051910': '화학',
  '006400': '배터리',
  '035720': 'IT서비스',
  '207940': '바이오',
  '068270': '바이오',
  '005380': '자동차',
  '012330': '자동차부품',
};

export async function GET(request: NextRequest) {
  try {
    console.log('Analytics API: Starting authentication check');
    const payload = await verifyToken(request);
    console.log('Analytics API: Token verification result:', payload ? 'SUCCESS' : 'FAILED');
    
    if (!payload) {
      console.log('Analytics API: No valid token found, returning 401');
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    console.log('Analytics API: Authenticated user ID:', payload.userId);

    // 사용자의 모든 보유종목 조회
    const holdings = await prisma.holding.findMany({
      where: {
        account: {
          userId: payload.userId,
        },
      },
      include: {
        account: {
          include: {
            broker: true,
          },
        },
      },
    });

    if (holdings.length === 0) {
      return NextResponse.json({
        analytics: {
          totalValue: 0,
          totalInvestment: 0,
          totalReturn: 0,
          totalReturnPercent: 0,
          sharpeRatio: 0,
          volatility: 0,
          maxDrawdown: 0,
          diversificationScore: 0,
          sectorAllocation: {},
          riskMetrics: { var95: 0, beta: 1, alpha: 0 },
          performance: { daily: 0, weekly: 0, monthly: 0, yearly: 0 },
        } as PortfolioAnalytics,
      });
    }

    // 현재 주가 정보 가져오기
    const stockCodes = holdings.map(h => h.stockCode);
    const pricesResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/stock-prices?codes=${stockCodes.join(',')}`);
    const pricesData = await pricesResponse.json();

    let totalValue = 0;
    let totalInvestment = 0;
    const sectorAllocation: { [key: string]: number } = {};

    // 각 보유종목의 현재 가치 및 투자금액 계산
    holdings.forEach(holding => {
      const currentPrice = pricesData.prices[holding.stockCode]?.currentPrice || holding.currentPrice;
      const value = holding.quantity * currentPrice;
      const investment = holding.quantity * holding.averagePrice;

      totalValue += value;
      totalInvestment += investment;

      // 섹터별 분배 계산
      const sector = SECTOR_MAPPING[holding.stockCode] || '기타';
      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + value;
    });

    // 수익률 계산
    const totalReturn = totalValue - totalInvestment;
    const totalReturnPercent = totalInvestment > 0 ? (totalReturn / totalInvestment) * 100 : 0;

    // 다양화 점수 계산 (간단한 허핀달 지수 기반)
    const totalSectors = Object.keys(sectorAllocation).length;
    const maxSectorWeight = Math.max(...Object.values(sectorAllocation)) / totalValue;
    const diversificationScore = Math.min(100, (1 - maxSectorWeight) * 100 + totalSectors * 10);

    // 리스크 메트릭 계산 (모의 데이터)
    const volatility = Math.random() * 30 + 10; // 10-40% 변동성
    const sharpeRatio = totalReturnPercent > 0 ? totalReturnPercent / volatility : 0;
    const maxDrawdown = Math.random() * -20; // 최대 -20% 손실
    const beta = 0.8 + Math.random() * 0.4; // 0.8-1.2 베타
    const alpha = totalReturnPercent - (beta * 8); // 시장 수익률을 8%로 가정

    // VaR 95% 계산 (간단한 파라메트릭 방법)
    const var95 = totalValue * 0.05 * Math.sqrt(volatility / 100);

    // 성과 분석 (모의 데이터)
    const performance = {
      daily: (Math.random() - 0.5) * 4, // -2% ~ +2%
      weekly: (Math.random() - 0.5) * 10, // -5% ~ +5%
      monthly: totalReturnPercent / 12, // 월평균 수익률
      yearly: totalReturnPercent,
    };

    const analytics: PortfolioAnalytics = {
      totalValue,
      totalInvestment,
      totalReturn,
      totalReturnPercent,
      sharpeRatio,
      volatility,
      maxDrawdown,
      diversificationScore,
      sectorAllocation,
      riskMetrics: {
        var95,
        beta,
        alpha,
      },
      performance,
    };

    return NextResponse.json({ analytics });

  } catch (error) {
    console.error('포트폴리오 분석 오류:', error);
    return NextResponse.json(
      { error: '포트폴리오 분석에 실패했습니다.' },
      { status: 500 }
    );
  }
}
