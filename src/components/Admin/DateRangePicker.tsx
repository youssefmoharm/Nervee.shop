import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  DATE_RANGES,
  addPeriodComparison,
  calculatePercentageChange,
  formatNumber,
  type DateRangeKey,
  type DateRangeWithPrevious,
} from '../../lib/dateRange';

interface DateRangePickerProps {
  initialRange?: DateRangeKey;
  onDateRangeChange?: (range: DateRangeWithPrevious) => void;
  className?: string;
}

export function DateRangePicker({
  initialRange = 'last_30_days',
  onDateRangeChange,
  className = '',
}: DateRangePickerProps) {
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>(initialRange);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate the current date range
  const dateRange = useMemo(() => {
    const now = new Date();
    let range = DATE_RANGES[selectedRange](now);

    if (selectedRange === 'custom' && customStartDate && customEndDate) {
      range = {
        ...range,
        start: new Date(customStartDate),
        end: new Date(customEndDate),
      };
    }

    return addPeriodComparison(range);
  }, [selectedRange, customStartDate, customEndDate]);

  // Update parent when date range changes
  useEffect(() => {
    if (onDateRangeChange) {
      onDateRangeChange(dateRange);
    }
  }, [dateRange, onDateRangeChange]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSelectedLabel = () => {
    if (selectedRange === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
    return DATE_RANGES[selectedRange](new Date()).label;
  };

  return (
    <div className={`relative ${className}`} ref={menuRef} role="none">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg hover:bg-navy-2 transition-colors"
      >
        <Calendar className="w-4 h-4" />
        <span className="text-sm">{getSelectedLabel()}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      {isMenuOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-navy/10 z-50 p-4"
          role="menu"
        >
          {/* Preset ranges */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-navy/60 uppercase tracking-wide mb-3">
              Presets
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DATE_RANGES).map(([key, rangeFn]) => {
                if (key === 'custom' || key === 'all_time') return null;
                const range = rangeFn(new Date());
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedRange(key as DateRangeKey);
                      setIsMenuOpen(false);
                    }}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      selectedRange === key
                        ? 'bg-navy text-white'
                        : 'bg-navy/5 text-navy hover:bg-navy/10'
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom date range */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-navy/60 uppercase tracking-wide mb-3">
              Custom Range
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-navy/60 mb-1" htmlFor="custom-start-date">
                  Start Date
                </label>
                <input
                  id="custom-start-date"
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-navy/20 rounded-lg focus:ring-2 focus:ring-navy focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-navy/60 mb-1" htmlFor="custom-end-date">
                  End Date
                </label>
                <input
                  id="custom-end-date"
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-navy/20 rounded-lg focus:ring-2 focus:ring-navy focus:border-transparent"
                />
              </div>
              <button
                onClick={() => {
                  setSelectedRange('custom');
                  setIsMenuOpen(false);
                }}
                disabled={!customStartDate || !customEndDate}
                className="w-full px-3 py-2 text-sm bg-navy text-white rounded-lg hover:bg-navy-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Apply Custom Range
              </button>
            </div>
          </div>

          {/* All time option */}
          <button
            onClick={() => {
              setSelectedRange('all_time');
              setIsMenuOpen(false);
            }}
            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
              selectedRange === 'all_time'
                ? 'bg-navy text-white'
                : 'bg-navy/5 text-navy hover:bg-navy/10'
            }`}
          >
            All Time
          </button>

          {/* Period comparison info */}
          <div className="mt-4 pt-4 border-t border-navy/10">
            <p className="text-xs text-navy/60 mb-2">
              Comparing to previous period ({formatNumber(dateRange.previousStart.getDate())}{' '}
              {dateRange.previousStart.toLocaleString('default', { month: 'short' })} -{' '}
              {formatNumber(dateRange.previousEnd.getDate())}{' '}
              {dateRange.previousEnd.toLocaleString('default', { month: 'short' })})
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function useDateRange(initialRange: DateRangeKey = 'last_30_days') {
  const [dateRange, setDateRange] = useState<DateRangeWithPrevious>(() => {
    const now = new Date();
    return addPeriodComparison(DATE_RANGES[initialRange](now));
  });

  const handleDateRangeChange = (range: DateRangeWithPrevious) => {
    setDateRange(range);
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

  return {
    dateRange,
    handleDateRangeChange,
    getPeriodComparison,
  };
}
