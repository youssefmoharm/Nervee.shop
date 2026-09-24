import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SharedWishlist {
  code: string;
  items: string[]; // product slugs
  message: string;
  createdAt: number;
  expiresAt: number | null;
}

interface ShareRow {
  share_code: string;
  items: unknown;
  message: string | null;
  created_at: string | null;
  expires_at: string | null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const CODE_LENGTH = 10;
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SHARE_COLUMNS = 'share_code, items, message, created_at, expires_at';

export function generateShareCode(length: number = CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function parseItems(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

function rowToShare(row: ShareRow): SharedWishlist {
  return {
    code: row.share_code,
    items: parseItems(row.items),
    message: row.message ?? '',
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
    expiresAt: row.expires_at ? Date.parse(row.expires_at) : null,
  };
}

export async function createShare(
  slugs: string[],
  message: string = '',
): Promise<{ share: SharedWishlist } | { error: string }> {
  if (slugs.length === 0) {
    return { error: 'Add items to your wishlist first' };
  }
  if (!isSupabaseConfigured) {
    return { error: 'Wishlist sharing is not available right now.' };
  }

  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    const code = generateShareCode();
    try {
      const { data, error } = await supabase
        .from('wishlist_shares')
        .insert({
          share_code: code,
          items: slugs,
          message: message || null,
          expires_at: new Date(Date.now() + SHARE_TTL_MS).toISOString(),
        })
        .select(SHARE_COLUMNS)
        .single();

      if (error) {
        // Unique violation on the primary key — retry with a fresh code.
        if (error.code === '23505' && i < attempts - 1) continue;
        return { error: 'Could not create a share link. Please try again.' };
      }
      return { share: rowToShare(data as ShareRow) };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }
  return { error: 'Could not create a share link. Please try again.' };
}

export async function getShare(
  code: string,
): Promise<{ share: SharedWishlist | null } | { error: string }> {
  if (!code) return { share: null };
  if (!isSupabaseConfigured) {
    return { error: 'Wishlist sharing is not available right now.' };
  }

  try {
    const { data, error } = await supabase
      .from('wishlist_shares')
      .select(SHARE_COLUMNS)
      .eq('share_code', code)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    if (error) {
      return { error: 'Network error. Please try again.' };
    }
    return { share: data ? rowToShare(data as ShareRow) : null };
  } catch {
    return { error: 'Network error. Please try again.' };
  }
}
