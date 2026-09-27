import { useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from 'chart.js';
import { LoadingState, EmptyState } from './Common';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
);

ChartJS.defaults.color = '#64748b';
ChartJS.defaults.borderColor = '#e2e8f0';
ChartJS.defaults.font.family = 'inherit';

interface RevenueChartProps {
  data: { date: string; revenue: number }[];
  loading: boolean;
  error?: Error | null;
}

export function RevenueChart({ data, loading, error }: RevenueChartProps) {
  const chartData = useMemo(
    () => ({
      labels: data.map(d => d.date),
      datasets: [
        {
          label: 'Revenue (EGP)',
          data: data.map(d => d.revenue),
          borderColor: '#1e40af',
          backgroundColor: 'rgba(30, 64, 175, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    }),
    [data],
  );

  if (loading) return <LoadingState message="Loading revenue data..." />;
  if (error) return <EmptyState title="Failed to load revenue data" />;
  if (!data || data.length === 0) return <EmptyState title="No revenue data available" />;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Revenue Over Time',
        font: { size: 16, weight: 'bold' as const },
        color: '#1e293b',
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#64748b',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            return `EGP ${context.parsed.y.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value: number) {
            return `EGP ${value.toLocaleString()}`;
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="h-96">
      <Line data={chartData} options={options as any} />
    </div>
  );
}

interface SalesChartProps {
  data: { label: string; value: number }[];
  loading: boolean;
  error?: Error | null;
}

export function SalesChart({ data, loading, error }: SalesChartProps) {
  const chartData = useMemo(
    () => ({
      labels: data.map(d => d.label),
      datasets: [
        {
          label: 'Units Sold',
          data: data.map(d => d.value),
          backgroundColor: '#1e40af',
          borderRadius: 4,
          hoverBackgroundColor: '#1e3a8a',
        },
      ],
    }),
    [data],
  );

  if (loading) return <LoadingState message="Loading sales data..." />;
  if (error) return <EmptyState title="Failed to load sales data" />;
  if (!data || data.length === 0) return <EmptyState title="No sales data available" />;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Sales by Product',
        font: { size: 16, weight: 'bold' as const },
        color: '#1e293b',
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#64748b',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            return `${context.parsed.y} units`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={chartData} options={options as any} />
    </div>
  );
}

interface OrdersOverTimeChartProps {
  data: { date: string; orders: number }[];
  loading: boolean;
  error?: Error | null;
}

export function OrdersOverTimeChart({ data, loading, error }: OrdersOverTimeChartProps) {
  const chartData = useMemo(
    () => ({
      labels: data.map(d => d.date),
      datasets: [
        {
          label: 'Orders',
          data: data.map(d => d.orders),
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    }),
    [data],
  );

  if (loading) return <LoadingState message="Loading orders data..." />;
  if (error) return <EmptyState title="Failed to load orders data" />;
  if (!data || data.length === 0) return <EmptyState title="No orders data available" />;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Orders Over Time',
        font: { size: 16, weight: 'bold' as const },
        color: '#1e293b',
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#64748b',
        borderColor: '#e2e8f0',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="h-96">
      <Line data={chartData} options={options as any} />
    </div>
  );
}
