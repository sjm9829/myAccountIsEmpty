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
  RadialLinearScale,
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';

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
  RadialLinearScale,
);

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
    var95: number;
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

interface AnalyticsChartsProps {
  analytics: PortfolioAnalytics;
}

const generateColors = (count: number) => {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  ];
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
};

export function SectorAllocationChart({ analytics }: AnalyticsChartsProps) {
  const sectors = Object.keys(analytics.sectorAllocation);
  const values = Object.values(analytics.sectorAllocation);

  const chartData = {
    labels: sectors,
    datasets: [
      {
        label: '섹터별 비중',
        data: values,
        backgroundColor: generateColors(sectors.length),
        borderColor: generateColors(sectors.length).map(color => color + '80'),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: { size: 12 },
          generateLabels: (chart: ChartJS) => {
            const data = chart.data;
            if (data.labels && data.labels.length && data.datasets.length) {
              const dataset = data.datasets[0];
              const total = (dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
              
              return (data.labels as string[]).map((label: string, i: number) => {
                const value = (dataset.data as number[])[i];
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
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
            const value = new Intl.NumberFormat('ko-KR', {
              style: 'currency',
              currency: 'KRW',
            }).format(context.parsed);
            const total = (context.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">섹터 분산</h3>
      <div style={{ height: '300px' }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}

export function RiskMetricsChart({ analytics }: AnalyticsChartsProps) {
  // 리스크 지표를 0-100 스케일로 정규화
  const normalizeRisk = (value: number, min: number, max: number) => {
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  };

  const chartData = {
    labels: ['변동성', '베타', '최대손실', '샤프비율', '다양화'],
    datasets: [
      {
        label: '리스크 프로파일',
        data: [
          normalizeRisk(analytics.volatility, 0, 50),
          normalizeRisk(analytics.riskMetrics.beta, 0, 2) * 100,
          normalizeRisk(Math.abs(analytics.maxDrawdown), 0, 50),
          normalizeRisk(analytics.sharpeRatio, -2, 3) * 20,
          analytics.diversificationScore,
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
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
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          display: false,
        },
        grid: {
          color: '#E5E7EB',
        },
        angleLines: {
          color: '#E5E7EB',
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">리스크 프로파일</h3>
      <div style={{ height: '300px' }}>
        <Radar data={chartData} options={options} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
        <div>변동성: {analytics.volatility.toFixed(1)}%</div>
        <div>베타: {analytics.riskMetrics.beta.toFixed(2)}</div>
        <div>최대손실: {analytics.maxDrawdown.toFixed(1)}%</div>
        <div>샤프비율: {analytics.sharpeRatio.toFixed(2)}</div>
        <div>다양화점수: {analytics.diversificationScore.toFixed(0)}</div>
        <div>VaR 95%: {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(analytics.riskMetrics.var95)}</div>
      </div>
    </div>
  );
}

export function PerformanceChart({ analytics }: AnalyticsChartsProps) {
  const chartData = {
    labels: ['일간', '주간', '월간', '연간'],
    datasets: [
      {
        label: '수익률 (%)',
        data: [
          analytics.performance.daily,
          analytics.performance.weekly,
          analytics.performance.monthly,
          analytics.performance.yearly,
        ],
        backgroundColor: [
          analytics.performance.daily >= 0 ? '#EF4444' : '#3B82F6',
          analytics.performance.weekly >= 0 ? '#EF4444' : '#3B82F6',
          analytics.performance.monthly >= 0 ? '#EF4444' : '#3B82F6',
          analytics.performance.yearly >= 0 ? '#EF4444' : '#3B82F6',
        ],
        borderColor: [
          analytics.performance.daily >= 0 ? '#DC2626' : '#2563EB',
          analytics.performance.weekly >= 0 ? '#DC2626' : '#2563EB',
          analytics.performance.monthly >= 0 ? '#DC2626' : '#2563EB',
          analytics.performance.yearly >= 0 ? '#DC2626' : '#2563EB',
        ],
        borderWidth: 1,
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
          label: function(context: TooltipItem<'bar'>) {
            return `${context.label}: ${context.parsed.y.toFixed(2)}%`;
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
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">기간별 성과</h3>
      <div style={{ height: '300px' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
