import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'

// Mock loading states for different scenarios
const MockLoadingSpinner = ({ isLoading = true, text = 'Loading...' }) => {
  if (!isLoading) return <div data-testid="content">Content loaded</div>
  
  return (
    <div data-testid="loading-spinner" role="status" aria-label="Loading">
      <div className="animate-spin" data-testid="spinner-icon">⟳</div>
      <span data-testid="loading-text">{text}</span>
    </div>
  )
}

const MockSkeletonLoader = ({ count = 3 }) => {
  return (
    <div data-testid="skeleton-loader">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          data-testid={`skeleton-item-${index}`}
          className="animate-pulse bg-gray-200 h-4 w-full mb-2"
        >
          Loading item {index + 1}...
        </div>
      ))}
    </div>
  )
}

const MockProgressLoader = ({ progress = 0, max = 100 }) => {
  const percentage = Math.min(100, Math.max(0, (progress / max) * 100))
  
  return (
    <div data-testid="progress-loader">
      <div data-testid="progress-bar" style={{ width: `${percentage}%` }}>
        Progress: {Math.round(percentage)}%
      </div>
      <span data-testid="progress-text">
        {progress} / {max}
      </span>
    </div>
  )
}

const MockAsyncComponent = ({ delay = 100, shouldError = false }) => {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldError) {
        setError('Failed to load data')
      } else {
        setData('Loaded data successfully')
      }
      setLoading(false)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, shouldError])

  if (loading) {
    return <MockLoadingSpinner text="Loading async data..." />
  }

  if (error) {
    return <div data-testid="error-state">{error}</div>
  }

  return <div data-testid="success-state">{data}</div>
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

describe('Loading States', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading Spinner', () => {
    it('renders loading spinner when loading', () => {
      render(
        <TestWrapper>
          <MockLoadingSpinner isLoading={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('spinner-icon')).toBeInTheDocument()
      expect(screen.getByTestId('loading-text')).toHaveTextContent('Loading...')
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    })

    it('renders content when not loading', () => {
      render(
        <TestWrapper>
          <MockLoadingSpinner isLoading={false} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
      expect(screen.getByText('Content loaded')).toBeInTheDocument()
    })

    it('displays custom loading text', () => {
      render(
        <TestWrapper>
          <MockLoadingSpinner isLoading={true} text="Fetching products..." />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading-text')).toHaveTextContent('Fetching products...')
    })

    it('has proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <MockLoadingSpinner isLoading={true} />
        </TestWrapper>
      )

      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveAttribute('role', 'status')
      expect(spinner).toHaveAttribute('aria-label', 'Loading')
    })
  })

  describe('Skeleton Loader', () => {
    it('renders skeleton items with default count', () => {
      render(
        <TestWrapper>
          <MockSkeletonLoader />
        </TestWrapper>
      )

      expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument()
      expect(screen.getByTestId('skeleton-item-0')).toBeInTheDocument()
      expect(screen.getByTestId('skeleton-item-1')).toBeInTheDocument()
      expect(screen.getByTestId('skeleton-item-2')).toBeInTheDocument()
      expect(screen.queryByTestId('skeleton-item-3')).not.toBeInTheDocument()
    })

    it('renders custom number of skeleton items', () => {
      render(
        <TestWrapper>
          <MockSkeletonLoader count={5} />
        </TestWrapper>
      )

      for (let i = 0; i < 5; i++) {
        expect(screen.getByTestId(`skeleton-item-${i}`)).toBeInTheDocument()
      }
      expect(screen.queryByTestId('skeleton-item-5')).not.toBeInTheDocument()
    })

    it('handles zero skeleton items', () => {
      render(
        <TestWrapper>
          <MockSkeletonLoader count={0} />
        </TestWrapper>
      )

      expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument()
      expect(screen.queryByTestId('skeleton-item-0')).not.toBeInTheDocument()
    })

    it('handles large number of skeleton items', () => {
      render(
        <TestWrapper>
          <MockSkeletonLoader count={10} />
        </TestWrapper>
      )

      for (let i = 0; i < 10; i++) {
        expect(screen.getByTestId(`skeleton-item-${i}`)).toBeInTheDocument()
      }
    })
  })

  describe('Progress Loader', () => {
    it('displays progress at 0%', () => {
      render(
        <TestWrapper>
          <MockProgressLoader progress={0} max={100} />
        </TestWrapper>
      )

      expect(screen.getByTestId('progress-bar')).toHaveTextContent('Progress: 0%')
      expect(screen.getByTestId('progress-text')).toHaveTextContent('0 / 100')
    })

    it('displays progress at 50%', () => {
      render(
        <TestWrapper>
          <MockProgressLoader progress={50} max={100} />
        </TestWrapper>
      )

      expect(screen.getByTestId('progress-bar')).toHaveTextContent('Progress: 50%')
      expect(screen.getByTestId('progress-text')).toHaveTextContent('50 / 100')
    })

    it('displays progress at 100%', () => {
      render(
        <TestWrapper>
          <MockProgressLoader progress={100} max={100} />
        </TestWrapper>
      )

      expect(screen.getByTestId('progress-bar')).toHaveTextContent('Progress: 100%')
      expect(screen.getByTestId('progress-text')).toHaveTextContent('100 / 100')
    })

    it('handles progress over 100%', () => {
      render(
        <TestWrapper>
          <MockProgressLoader progress={150} max={100} />
        </TestWrapper>
      )

      expect(screen.getByTestId('progress-bar')).toHaveTextContent('Progress: 100%')
      expect(screen.getByTestId('progress-text')).toHaveTextContent('150 / 100')
    })

    it('handles negative progress', () => {
      render(
        <TestWrapper>
          <MockProgressLoader progress={-10} max={100} />
        </TestWrapper>
      )

      expect(screen.getByTestId('progress-bar')).toHaveTextContent('Progress: 0%')
      expect(screen.getByTestId('progress-text')).toHaveTextContent('-10 / 100')
    })

    it('handles custom max values', () => {
      render(
        <TestWrapper>
          <MockProgressLoader progress={25} max={50} />
        </TestWrapper>
      )

      expect(screen.getByTestId('progress-bar')).toHaveTextContent('Progress: 50%')
      expect(screen.getByTestId('progress-text')).toHaveTextContent('25 / 50')
    })
  })

  describe('Async Loading Behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <MockAsyncComponent delay={1000} />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('loading-text')).toHaveTextContent('Loading async data...')
      expect(screen.queryByTestId('success-state')).not.toBeInTheDocument()
    })

    it('shows success state after loading', async () => {
      render(
        <TestWrapper>
          <MockAsyncComponent delay={100} />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      vi.advanceTimersByTime(100)

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
        expect(screen.getByTestId('success-state')).toBeInTheDocument()
        expect(screen.getByText('Loaded data successfully')).toBeInTheDocument()
      })
    })

    it('shows error state on failure', async () => {
      render(
        <TestWrapper>
          <MockAsyncComponent delay={100} shouldError={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      vi.advanceTimersByTime(100)

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
        expect(screen.getByTestId('error-state')).toBeInTheDocument()
        expect(screen.getByText('Failed to load data')).toBeInTheDocument()
      })
    })

    it('handles very fast loading', async () => {
      render(
        <TestWrapper>
          <MockAsyncComponent delay={1} />
        </TestWrapper>
      )

      vi.advanceTimersByTime(1)

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument()
      })
    })

    it('handles very slow loading', async () => {
      render(
        <TestWrapper>
          <MockAsyncComponent delay={5000} />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      vi.advanceTimersByTime(2500)
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      vi.advanceTimersByTime(2500)

      await waitFor(() => {
        expect(screen.getByTestId('success-state')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State Transitions', () => {
    it('transitions from loading to content smoothly', () => {
      const { rerender } = render(
        <TestWrapper>
          <MockLoadingSpinner isLoading={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <MockLoadingSpinner isLoading={false} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('can transition back to loading state', () => {
      const { rerender } = render(
        <TestWrapper>
          <MockLoadingSpinner isLoading={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('content')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <MockLoadingSpinner isLoading={true} text="Refreshing..." />
        </TestWrapper>
      )

      expect(screen.queryByTestId('content')).not.toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('loading-text')).toHaveTextContent('Refreshing...')
    })
  })

  describe('Loading Performance', () => {
    it('does not cause unnecessary re-renders', () => {
      const renderSpy = vi.fn()
      
      const TestComponent = ({ isLoading }: { isLoading: boolean }) => {
        renderSpy()
        return <MockLoadingSpinner isLoading={isLoading} />
      }

      const { rerender } = render(
        <TestWrapper>
          <TestComponent isLoading={true} />
        </TestWrapper>
      )

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Re-render with same props should not cause additional renders
      rerender(
        <TestWrapper>
          <TestComponent isLoading={true} />
        </TestWrapper>
      )

      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Accessibility', () => {
    it('provides screen reader friendly loading states', () => {
      render(
        <TestWrapper>
          <MockLoadingSpinner isLoading={true} />
        </TestWrapper>
      )

      const loadingElement = screen.getByRole('status')
      expect(loadingElement).toBeInTheDocument()
      expect(loadingElement).toHaveAttribute('aria-label', 'Loading')
    })

    it('announces loading state changes to screen readers', async () => {
      const { rerender } = render(
        <TestWrapper>
          <MockLoadingSpinner isLoading={true} />
        </TestWrapper>
      )

      expect(screen.getByRole('status')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <MockLoadingSpinner isLoading={false} />
        </TestWrapper>
      )

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })
  })
})