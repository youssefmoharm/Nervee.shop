import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSkeletonProps {
  count?: number;
  type?: 'card' | 'table' | 'list';
  className?: string;
}

export function LoadingSkeleton({
  count = 3,
  type = 'card',
  className = '',
}: LoadingSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse ${
            type === 'card'
              ? 'bg-navy/5 rounded-lg h-32'
              : type === 'table'
              ? 'h-12 bg-navy/5 rounded'
              : 'h-4 bg-navy/5 rounded'
          }`}
        />
      ))}
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="animate-spin text-navy/60 mb-4" size={24} />
      <p className="text-navy/60">{message}</p>
    </div>
  );
}

export function EmptyState({
  title = 'No data available',
  description = 'Try adjusting your filters or wait for data to be populated',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 p-4 bg-navy/5 rounded-full">
        <div className="text-navy/40">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-medium text-navy mb-2">{title}</h3>
      <p className="text-navy/60 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try refreshing the page',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 p-4 bg-red-50 rounded-full">
        <div className="text-red-600">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-medium text-navy mb-2">{title}</h3>
      <p className="text-navy/60 max-w-sm mb-6">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="nv-eyebrow px-4 py-2 bg-navy text-white rounded hover:bg-navy-2"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export function StatusBadge({
  status,
  type = 'default',
}: {
  status: string;
  type?: 'default' | 'success' | 'warning' | 'error' | 'info';
}) {
  const getStatusStyles = (status: string, type: string) => {
    const statusLower = status.toLowerCase();

    if (type === 'success') return 'bg-green-50 text-green-700 border-green-200';
    if (type === 'warning') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (type === 'error') return 'bg-red-50 text-red-700 border-red-200';
    if (type === 'info') return 'bg-blue-50 text-blue-700 border-blue-200';

    // Auto-detect based on status text
    if (
      statusLower.includes('complete') ||
      statusLower.includes('success') ||
      statusLower.includes('delivered') ||
      statusLower.includes('paid') ||
      statusLower.includes('active')
    ) {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    if (
      statusLower.includes('pending') ||
      statusLower.includes('processing') ||
      statusLower.includes('partial')
    ) {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
    if (
      statusLower.includes('cancel') ||
      statusLower.includes('refunded') ||
      statusLower.includes('failed') ||
      statusLower.includes('inactive')
    ) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (statusLower.includes('shipped') || statusLower.includes('out')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles(
        status,
        type,
      )}`}
    >
      {status}
    </span>
  );
}

export function KPICard({
  title,
  value,
  change,
  changeType = 'neutral',
}: {
  title: string;
  value: string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <div className="border border-navy/10 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
      <p className="nv-eyebrow text-xs text-navy/60 mb-2">{title}</p>
      <p className="text-3xl font-semibold text-navy mb-2">{value}</p>
      {change !== undefined && (
        <div
          className={`text-sm flex items-center ${
            changeType === 'positive'
              ? 'text-green-600'
              : changeType === 'negative'
              ? 'text-red-600'
              : 'text-navy/60'
          }`}
        >
          {changeType === 'positive' && (
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          )}
          {changeType === 'negative' && (
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
              />
            </svg>
          )}
          <span>{Math.abs(change).toFixed(1)}% from previous period</span>
        </div>
      )}
    </div>
  );
}
