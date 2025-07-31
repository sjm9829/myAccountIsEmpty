'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  TooltipItem,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
);

interface Holding {
  id: string;
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  totalValueKRW: number;
  totalInvestment: number;
  totalInvestmentKRW: number;
  profitLoss: number;
  profitLossKRW: number;
  profitLossPercentage: number;
  currency: string;
}

interface PortfolioChartsProps {
  holdings: Holding[];
}

const generateColors = (count: number) => {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  ];
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
};

export function PortfolioAllocationChart({ holdings }: PortfolioChartsProps) {
  // 종목별로 합치기 (다른 계좌의 동일 종목 통합)
  const aggregatedHoldings = holdings.reduce((acc, holding) => {
    const key = `${holding.stockCode}-${holding.currency || 'KRW'}`;
    if (acc[key]) {
      acc[key].totalValueKRW += holding.totalValueKRW || holding.totalValue;
      acc[key].totalValue += holding.totalValue;
      acc[key].quantity += holding.quantity;
    } else {
      acc[key] = {
        stockCode: holding.stockCode,
        stockName: holding.stockName,
        currency: holding.currency || 'KRW',
        totalValueKRW: holding.totalValueKRW || holding.totalValue,
        totalValue: holding.totalValue,
        quantity: holding.quantity
      };
    }
    return acc;
  }, {} as Record<string, {
    stockCode: string;
    stockName: string;
    currency: string;
    totalValueKRW: number;
    totalValue: number;
    quantity: number;
  }>);

  // 배열로 변환하고 비율이 큰 순서로 정렬
  const sortedHoldings = Object.values(aggregatedHoldings)
    .sort((a, b) => b.totalValueKRW - a.totalValueKRW);

  const chartData = {
    labels: sortedHoldings.map(h => `${h.stockName} (${h.currency})`),
    datasets: [
      {
        label: '포트폴리오 비중',
        data: sortedHoldings.map(h => h.totalValueKRW),
        backgroundColor: generateColors(sortedHoldings.length),
        borderColor: generateColors(sortedHoldings.length).map(color => color + '80'),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest' as const,
      intersect: false,
    },
    onClick: () => {
      // 클릭 이벤트를 무시하여 범례가 토글되지 않도록 함
      return false;
    },
    plugins: {
      legend: {
        position: 'right' as const,
        onClick: () => {
          // 범례 클릭 이벤트도 무시
          return false;
        },
        labels: {
          font: {
            size: 12,
          },
          generateLabels: (chart: ChartJS) => {
            const data = chart.data;
            if (data.labels && data.labels.length && data.datasets.length) {
              const dataset = data.datasets[0];
              const total = (dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
              
              return (data.labels as string[]).map((label: string, i: number) => {
                const value = (dataset.data as number[])[i];
                const percentage = ((value / total) * 100).toFixed(1);
                return {
                  text: `${label} (${percentage}%)`,
                  fillStyle: (dataset.backgroundColor as string[])[i],
                  strokeStyle: (dataset.borderColor as string[])[i],
                  lineWidth: dataset.borderWidth as number,
                  hidden: false,
                  index: i,
                };
              });
            }
            return [];
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'doughnut'>) {
            const label = context.label || '';
            const index = context.dataIndex;
            const holding = sortedHoldings[index];
            
            // 원화 환산 값 (차트에서 사용하는 값)
            const valueKRW = new Intl.NumberFormat('ko-KR', {
              style: 'currency',
              currency: 'KRW',
            }).format(context.parsed);
            
            // 원래 통화 값
            const originalValue = holding.currency === 'USD' 
              ? new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(holding.totalValue)
              : new Intl.NumberFormat('ko-KR', {
                  style: 'currency',
                  currency: 'KRW',
                }).format(holding.totalValue);
            
            const total = (context.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            
            // 수량 정보도 추가
            const quantityInfo = `수량: ${holding.quantity.toLocaleString()}주`;
            
            // 통화가 다른 경우 원래 통화 값도 표시
            if (holding.currency === 'USD') {
              return [
                `${label}: ${valueKRW} (${percentage}%)`, 
                `원래 금액: ${originalValue}`,
                quantityInfo
              ];
            } else {
              return [
                `${label}: ${valueKRW} (${percentage}%)`,
                quantityInfo
              ];
            }
          },
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">포트폴리오 구성</h3>
      <div style={{ height: '300px' }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}

export function ProfitLossChart({ holdings }: PortfolioChartsProps) {
  // 종목별로 합치기 (다른 계좌의 동일 종목 통합)
  const aggregatedHoldings = holdings.reduce((acc, holding) => {
    const key = `${holding.stockCode}-${holding.currency || 'KRW'}`;
    if (acc[key]) {
      acc[key].profitLossKRW += holding.profitLossKRW || holding.profitLoss;
      acc[key].profitLoss += holding.profitLoss;
    } else {
      acc[key] = {
        stockCode: holding.stockCode,
        stockName: holding.stockName,
        currency: holding.currency || 'KRW',
        profitLossKRW: holding.profitLossKRW || holding.profitLoss,
        profitLoss: holding.profitLoss
      };
    }
    return acc;
  }, {} as Record<string, {
    stockCode: string;
    stockName: string;
    currency: string;
    profitLossKRW: number;
    profitLoss: number;
  }>);

  // 배열로 변환하고 손익이 큰 순서로 정렬 (수익 -> 손실 순)
  const sortedHoldings = Object.values(aggregatedHoldings)
    .sort((a, b) => b.profitLossKRW - a.profitLossKRW);

  const profitLossKRW = sortedHoldings.map(h => h.profitLossKRW);

  const chartData = {
    labels: sortedHoldings.map(h => `${h.stockName} (${h.currency})`),
    datasets: [
      {
        label: '손익',
        data: profitLossKRW,
        backgroundColor: profitLossKRW.map(pl => 
          pl > 0 ? '#EF4444' : pl < 0 ? '#3B82F6' : '#6B7280'
        ),
        borderColor: profitLossKRW.map(pl => 
          pl > 0 ? '#DC2626' : pl < 0 ? '#2563EB' : '#4B5563'
        ),
        borderWidth: 1,
      },
    ],
  };

  // 통계 계산
  const profitCount = sortedHoldings.filter(h => h.profitLossKRW > 0).length;
  const lossCount = sortedHoldings.filter(h => h.profitLossKRW < 0).length;
  const neutralCount = sortedHoldings.filter(h => h.profitLossKRW === 0).length;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'bar'>) {
            const index = context.dataIndex;
            const holding = sortedHoldings[index];
            
            // 원화 환산 값 (차트에서 사용하는 값)
            const valueKRW = new Intl.NumberFormat('ko-KR', {
              style: 'currency',
              currency: 'KRW',
            }).format(context.parsed.y);
            
            // 원래 통화 값
            const originalValue = holding.currency === 'USD' 
              ? new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(holding.profitLoss)
              : new Intl.NumberFormat('ko-KR', {
                  style: 'currency',
                  currency: 'KRW',
                }).format(holding.profitLoss);
            
            // 통화가 다른 경우 원래 통화 값도 표시
            if (holding.currency === 'USD') {
              return [`손익: ${valueKRW}`, `원래 금액: ${originalValue}`];
            } else {
              return `손익: ${valueKRW}`;
            }
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: string | number) {
            return new Intl.NumberFormat('ko-KR', {
              style: 'currency',
              currency: 'KRW',
              notation: 'compact',
            }).format(value as number);
          },
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">종목별 손익</h3>
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
          <span className="text-gray-600 dark:text-gray-400">수익: {profitCount}종목</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
          <span className="text-gray-600 dark:text-gray-400">손실: {lossCount}종목</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-gray-500 rounded mr-2"></div>
          <span className="text-gray-600 dark:text-gray-400">보합: {neutralCount}종목</span>
        </div>
      </div>
      <div style={{ height: '300px' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

export function PerformanceChart({ holdings }: PortfolioChartsProps) {
  // 종목별로 합치기 (다른 계좌의 동일 종목 통합)
  const aggregatedHoldings = holdings.reduce((acc, holding) => {
    const key = `${holding.stockCode}-${holding.currency || 'KRW'}`;
    if (acc[key]) {
      const totalValue = acc[key].totalValueKRW + (holding.totalValueKRW || holding.totalValue);
      const totalInvestment = acc[key].totalInvestmentKRW + (holding.totalInvestmentKRW || holding.totalInvestment || holding.quantity * holding.averagePrice);
      
      acc[key].totalValueKRW = totalValue;
      acc[key].totalInvestmentKRW = totalInvestment;
      acc[key].profitLossPercentage = totalInvestment > 0 ? ((totalValue - totalInvestment) / totalInvestment) * 100 : 0;
    } else {
      const totalInvestment = holding.totalInvestmentKRW || holding.totalInvestment || holding.quantity * holding.averagePrice;
      acc[key] = {
        stockCode: holding.stockCode,
        stockName: holding.stockName,
        currency: holding.currency || 'KRW',
        totalValueKRW: holding.totalValueKRW || holding.totalValue,
        totalInvestmentKRW: totalInvestment,
        profitLossPercentage: totalInvestment > 0 ? ((holding.totalValueKRW || holding.totalValue) - totalInvestment) / totalInvestment * 100 : 0
      };
    }
    return acc;
  }, {} as Record<string, {
    stockCode: string;
    stockName: string;
    currency: string;
    totalValueKRW: number;
    totalInvestmentKRW: number;
    profitLossPercentage: number;
  }>);

  // 배열로 변환하고 수익률이 높은 순서로 정렬
  const sortedHoldings = Object.values(aggregatedHoldings)
    .sort((a, b) => b.profitLossPercentage - a.profitLossPercentage);

  const chartData = {
    labels: sortedHoldings.map(h => `${h.stockName} (${h.currency})`),
    datasets: [
      {
        label: '수익률 (%)',
        data: sortedHoldings.map(h => h.profitLossPercentage),
        fill: false,
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F6',
        tension: 0.1,
        pointBackgroundColor: sortedHoldings.map(h => 
          h.profitLossPercentage > 0 ? '#EF4444' : 
          h.profitLossPercentage < 0 ? '#3B82F6' : '#6B7280'
        ),
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'line'>) {
            return `수익률: ${context.parsed.y.toFixed(2)}%`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: string | number) {
            return `${value}%`;
          },
        },
        grid: {
          color: '#E5E7EB',
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">종목별 수익률</h3>
      <div style={{ height: '300px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
