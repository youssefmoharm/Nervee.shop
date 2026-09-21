import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { logError } from '../../lib/sentry';
import {
  buildVirtualTryOnPayload,
  describeTryOnState,
  isMissingColumnError,
  validateTryOnDraft,
} from '../../lib/tryOnAdmin';
import AdminLayout from './AdminLayout';

interface TryOnProductRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  is_active: boolean | null;
  virtual_try_on: unknown;
}

interface Draft {
  enabled: boolean;
  lensId: string;
  lensGroupId: string;
}

type RowStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'error'; errors: string[] };

const emptyDraft: Draft = { enabled: false, lensId: '', lensGroupId: '' };

/** Build a form draft from whatever is stored in products.virtual_try_on. */
function draftFromConfig(raw: unknown): Draft {
  if (!raw || typeof raw !== 'object') return { ...emptyDraft };
  const cfg = raw as { enabled?: boolean; lensId?: string; lensGroupId?: string };
  return {
    enabled: cfg.enabled === true,
    lensId: typeof cfg.lensId === 'string' ? cfg.lensId : '',
    lensGroupId: typeof cfg.lensGroupId === 'string' ? cfg.lensGroupId : '',
  };
}

/**
 * Admin → AR Try-On
 *
 * Assigns each product its own Snap lens (Lens ID + Lens Group ID) and writes
 * it to `products.virtual_try_on` — the same column the storefront resolves at
 * runtime, so no code change or SQL is needed to roll AR out to a product.
 */
export default function VirtualTryOn() {
  const [products, setProducts] = useState<TryOnProductRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const { data, error } = await adminService.listProductsForTryOn();
      if (error) {
        setLoadError(error);
        setProducts([]);
        return;
      }
      const rows = data as TryOnProductRow[];
      setProducts(rows);
      setDrafts(Object.fromEntries(rows.map(r => [r.id, draftFromConfig(r.virtual_try_on)])));
    } catch (err) {
      logError('Failed to load try-on products', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load products.');
      setProducts([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const missingColumn = isMissingColumnError(loadError);

  const filtered = useMemo(() => {
    if (!products) return null;
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      p =>
        p.name?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q),
    );
  }, [products, query]);

  const enabledCount = useMemo(
    () => (products ?? []).filter(p => describeTryOnState(p.virtual_try_on).enabled).length,
    [products],
  );

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] ?? emptyDraft), ...patch } }));
    setStatuses(prev => ({ ...prev, [id]: { state: 'idle' } }));
  };

  const save = async (row: TryOnProductRow) => {
    const draft = drafts[row.id] ?? emptyDraft;
    const validation = validateTryOnDraft({ productId: row.id, ...draft });

    if (!validation.ok) {
      setStatuses(prev => ({ ...prev, [row.id]: { state: 'error', errors: validation.errors } }));
      return;
    }

    setStatuses(prev => ({ ...prev, [row.id]: { state: 'saving' } }));
    const payload = buildVirtualTryOnPayload({ productId: row.id, ...draft });
    const { error } = await adminService.updateProductVirtualTryOn(row.id, payload);

    if (error) {
      setStatuses(prev => ({
        ...prev,
        [row.id]: { state: 'error', errors: [error] },
      }));
      return;
    }

    // Reflect the saved state locally (no refetch needed).
    setProducts(prev =>
      (prev ?? []).map(p => (p.id === row.id ? { ...p, virtual_try_on: payload } : p)),
    );
    setDrafts(prev => ({ ...prev, [row.id]: draftFromConfig(payload) }));
    setStatuses(prev => ({ ...prev, [row.id]: { state: 'saved' } }));
  };

  const disable = async (row: TryOnProductRow) => {
    setStatuses(prev => ({ ...prev, [row.id]: { state: 'saving' } }));
    const { error } = await adminService.updateProductVirtualTryOn(row.id, null);
    if (error) {
      setStatuses(prev => ({ ...prev, [row.id]: { state: 'error', errors: [error] } }));
      return;
    }
    setProducts(prev =>
      (prev ?? []).map(p => (p.id === row.id ? { ...p, virtual_try_on: null } : p)),
    );
    setDrafts(prev => ({ ...prev, [row.id]: { ...emptyDraft } }));
    setStatuses(prev => ({ ...prev, [row.id]: { state: 'saved' } }));
  };

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="nv-heading text-4xl">AR Try-On</h1>
          <p className="text-sm text-navy/60 mt-2 max-w-2xl">
            Give each product its own Snap lens. Paste the Lens ID and Lens Group ID from the{' '}
            <a
              href="https://kit.snapchat.com/lens-scheduler"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-navy"
            >
              Lens Scheduler
            </a>{' '}
            and save — the storefront picks it up automatically, no deploy needed.
          </p>
        </div>
        {products && (
          <div className="flex items-center gap-2 bg-mist/60 border border-navy/10 px-4 py-3">
            <Sparkles size={15} className="text-navy/60" />
            <span className="text-xs text-navy/70">
              <strong className="text-navy">{enabledCount}</strong> of{' '}
              <strong className="text-navy">{products.length}</strong> products have AR enabled
            </span>
          </div>
        )}
      </div>

      {/* Migration not applied yet */}
      {missingColumn && (
        <div
          data-testid="migration-warning"
          className="mt-6 border border-warning/40 bg-warning/10 p-4 flex items-start gap-3"
        >
          <TriangleAlert size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm text-navy/80">
            <p className="font-semibold text-navy mb-1">Database column missing</p>
            <p>
              The <code className="text-xs">products.virtual_try_on</code> column doesn&apos;t exist
              yet. Run the migration once:
            </p>
            <pre className="mt-2 text-xs bg-white border border-navy/10 p-3 overflow-x-auto">
              supabase db push{'\n'}# or apply supabase/migrations/024_product_virtual_try_on.sql
            </pre>
          </div>
        </div>
      )}

      {/* Other load errors */}
      {loadError && !missingColumn && (
        <div className="mt-6 border border-error/40 bg-error/10 p-4 text-sm text-navy/80">
          <p className="font-semibold text-navy mb-1">Could not load products</p>
          <p>{loadError}</p>
          <button onClick={load} className="nv-eyebrow text-[10px] underline mt-2">
            Try again
          </button>
        </div>
      )}

      {/* Search */}
      {products && products.length > 0 && (
        <label className="flex items-center gap-2 border border-navy/20 px-4 py-3 max-w-md mt-8">
          <Search size={15} className="text-navy/40" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full text-sm focus:outline-none"
          />
        </label>
      )}

      {!products ? (
        <div className="mt-8">
          <Loader2 className="animate-spin text-navy/40" size={20} />
        </div>
      ) : products.length === 0 ? (
        <p className="mt-8 text-sm text-navy/60">No products found.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {(filtered ?? []).map(row => {
            const draft = drafts[row.id] ?? emptyDraft;
            const status: RowStatus = statuses[row.id] ?? { state: 'idle' };
            const current = describeTryOnState(row.virtual_try_on);

            return (
              <div
                key={row.id}
                data-testid={`tryon-row-${row.id}`}
                className="border border-navy/10 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="font-medium text-navy truncate">{row.name}</p>
                    <p className="text-xs text-navy/50 mt-0.5">
                      {row.category ?? 'Uncategorised'} · /{row.slug}
                      {row.is_active === false ? ' · inactive' : ''}
                    </p>
                  </div>
                  <span
                    className={`nv-eyebrow text-[10px] px-2.5 py-1 ${
                      current.enabled ? 'bg-navy text-white' : 'bg-mist text-navy/60'
                    }`}
                    title={current.summary}
                  >
                    {current.summary}
                  </span>
                </div>

                <div className="grid md:grid-cols-[auto_1fr_1fr] gap-4 items-end">
                  <label className="flex items-center gap-2 md:pb-3.5">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={e => updateDraft(row.id, { enabled: e.target.checked })}
                      aria-label={`Enable AR for ${row.name}`}
                      className="w-4 h-4 accent-navy"
                    />
                    <span className="text-xs font-medium text-navy/70">Enable AR</span>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-navy/60 mb-1.5 block">Lens ID</span>
                    <input
                      value={draft.lensId}
                      onChange={e => updateDraft(row.id, { lensId: e.target.value })}
                      placeholder="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
                      spellCheck={false}
                      aria-label={`Lens ID for ${row.name}`}
                      className="w-full border border-navy/20 px-4 py-3 text-sm font-mono focus:outline-none focus:border-navy"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-navy/60 mb-1.5 block">
                      Lens Group ID
                    </span>
                    <input
                      value={draft.lensGroupId}
                      onChange={e => updateDraft(row.id, { lensGroupId: e.target.value })}
                      placeholder="f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6"
                      spellCheck={false}
                      aria-label={`Lens Group ID for ${row.name}`}
                      className="w-full border border-navy/20 px-4 py-3 text-sm font-mono focus:outline-none focus:border-navy"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => save(row)}
                    disabled={status.state === 'saving'}
                    data-testid={`save-${row.id}`}
                    className="bg-navy text-white nv-eyebrow px-6 py-3 hover:bg-navy-2 transition-colors disabled:opacity-50"
                  >
                    {status.state === 'saving' ? 'Saving…' : 'Save'}
                  </button>

                  {current.enabled && (
                    <button
                      type="button"
                      onClick={() => disable(row)}
                      className="nv-eyebrow text-[10px] text-navy/50 hover:text-red-600 transition-colors"
                    >
                      Clear AR
                    </button>
                  )}

                  {status.state === 'saved' && (
                    <span className="text-xs text-success flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Saved
                    </span>
                  )}
                </div>

                {status.state === 'error' && (
                  <ul className="mt-3 space-y-1" data-testid={`errors-${row.id}`}>
                    {status.errors.map(msg => (
                      <li key={msg} className="text-xs text-error">
                        {msg}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {filtered && filtered.length === 0 && (
            <p className="text-sm text-navy/60">No products match “{query}”.</p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
