import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  DATE_RANGES,
  addPeriodComparison,
  calculatePercentageChange,
  type DateRangeWithPrevious,
} from '../lib/dateRange';

interface AdminContextType {
  dateRange: DateRangeWithPrevious;
  setDateRange: (range: DateRangeWithPrevious) => void;
  setCustomDateRange: (start: Date, end: Date) => void;
  getPeriodComparison: (
    current: number,
    previous: number,
  ) => {
    percentage: number;
    isPositive: boolean;
    isNegative: boolean;
    isNeutral: boolean;
  };
  isMobile: boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRangeWithPrevious>(() => {
    const now = new Date();
    return addPeriodComparison(DATE_RANGES['last_30_days'](now));
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDateRangeChange = (range: DateRangeWithPrevious) => {
    setDateRange(range);
  };

  const setCustomDateRange = (start: Date, end: Date) => {
    const range = DATE_RANGES['custom'](new Date());
    const newRange = {
      ...range,
      start,
      end,
      previousStart: new Date(start.getTime() - (end.getTime() - start.getTime())),
      previousEnd: new Date(start.getTime() - 1),
    };
    setDateRange(newRange);
  };

  const getPeriodComparison = (current: number, previous: number) => {
    const percentage = calculatePercentageChange(current, previous);
    return {
      percentage,
      isPositive: percentage > 0,
      isNegative: percentage < 0,
      isNeutral: percentage === 0,
    };
  };

  const value = useMemo(
    () => ({
      dateRange,
      setDateRange: handleDateRangeChange,
      setCustomDateRange,
      getPeriodComparison,
      isMobile,
    }),
    [dateRange, isMobile],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
