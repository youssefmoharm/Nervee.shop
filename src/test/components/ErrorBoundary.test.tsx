import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';

vi.mock('../../lib/sentry', () => ({ logError: vi.fn() }));

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <div>content-ok</div>;
}

function renderBoundary(resetKey: string, shouldThrow: boolean) {
  return (
    <ErrorBoundary resetKeys={[resetKey]}>
      <Boom shouldThrow={shouldThrow} />
    </ErrorBoundary>
  );
}

describe('ErrorBoundary resetKeys (BUG-03)', () => {
  it('shows the fallback while the error persists and keys are unchanged', () => {
    const { rerender } = render(renderBoundary('/a', true));
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    rerender(renderBoundary('/a', true));
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('resets and re-renders children when a resetKey changes', () => {
    const { rerender } = render(renderBoundary('/a', true));
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    rerender(renderBoundary('/b', false));
    expect(screen.getByText('content-ok')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('renders children normally when nothing throws', () => {
    render(renderBoundary('/a', false));
    expect(screen.getByText('content-ok')).toBeTruthy();
  });
});
