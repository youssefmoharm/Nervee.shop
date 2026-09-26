export type DateRangeKey =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom'
  | 'all_time';

export interface DateRange {
  label: string;
  key: DateRangeKey;
  start: Date;
  end: Date;
}

export interface DateRangeWithPrevious extends DateRange {
  previousStart: Date;
  previousEnd: Date;
}

export const DATE_RANGES: Record<DateRangeKey, (today: Date) => DateRange> = {
  today: today => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { label: 'Today', key: 'today', start, end };
  },

  yesterday: today => {
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { label: 'Yesterday', key: 'yesterday', start, end };
  },

  last_7_days: today => {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { label: 'Last 7 Days', key: 'last_7_days', start, end };
  },

  last_30_days: today => {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { label: 'Last 30 Days', key: 'last_30_days', start, end };
  },

  this_month: today => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { label: 'This Month', key: 'this_month', start, end };
  },

  last_month: today => {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    end.setHours(23, 59, 59, 999);
    return { label: 'Last Month', key: 'last_month', start, end };
  },

  this_year: today => {
    const start = new Date(today.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { label: 'This Year', key: 'this_year', start, end };
  },

  custom: today => {
    // Should be set via setCustomDateRange
    return { label: 'Custom', key: 'custom', start: today, end: today };
  },

  all_time: today => {
    const start = new Date('2020-01-01'); // Before our earliest data
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { label: 'All Time', key: 'all_time', start, end };
  },
};

export function getDateRange(key: DateRangeKey, today: Date = new Date()): DateRange {
  return DATE_RANGES[key](today);
}

export function addPeriodComparison(range: DateRange): DateRangeWithPrevious {
  const duration = range.end.getTime() - range.start.getTime();
  const previousStart = new Date(range.start);
  previousStart.setTime(previousStart.getTime() - duration);
  const previousEnd = new Date(range.end);
  previousEnd.setTime(previousEnd.getTime() - duration);

  return {
    ...range,
    previousStart,
    previousEnd,
  };
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatCurrency(amount: number, currency: string = 'EGP'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
