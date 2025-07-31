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
import { Bar, Doughnut } from 'react-chartjs-2';

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

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  institution: {
    id: string;
    name: string;
  };
  balance: number;
}

interface AccountDistributionChartProps {
  accounts: Account[];
}

const generateColors = (count: number) => {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  ];
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
};

export function AccountDistributionChart({ accounts }: AccountDistributionChartProps) {
  const chartData = {
    labels: accounts.map(account => `${account.institution.name} - ${account.accountNumber}`),
    datasets: [
      {
        label: '계좌별 잔액',
        data: accounts.map(account => account.balance),
        backgroundColor: generateColors(accounts.length),
        borderColor: generateColors(accounts.length).map(color => color + '80'),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
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
            return `잔액: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">계좌별 잔액 분포</h3>
      <div style={{ height: '300px' }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}

interface MonthlyTransactionData {
  month: string;
  buy: number;
  sell: number;
  dividend: number;
}

interface MonthlyTransactionChartProps {
  data: MonthlyTransactionData[];
}

export function MonthlyTransactionChart({ data }: MonthlyTransactionChartProps) {
  const chartData = {
    labels: data.map(d => d.month),
    datasets: [
      {
        label: '매수',
        data: data.map(d => d.buy),
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        borderWidth: 1,
      },
      {
        label: '매도',
        data: data.map(d => d.sell),
        backgroundColor: '#3B82F6',
        borderColor: '#2563EB',
        borderWidth: 1,
      },
      {
        label: '배당',
        data: data.map(d => d.dividend),
        backgroundColor: '#10B981',
        borderColor: '#059669',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'bar'>) {
            const value = new Intl.NumberFormat('ko-KR', {
              style: 'currency',
              currency: 'KRW',
            }).format(context.parsed.y);
            return `${context.dataset.label}: ${value}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true,
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
      x: {
        stacked: true,
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">월별 거래 현황</h3>
      <div style={{ height: '300px' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
