export function generateShareCode(): string {
  return Math.random().toString(36).substring(2, 12);
}

export interface SharedWishlist {
  code: string;
  items: string[]; // product slugs
  message: string;
  createdAt: number;
  expiresAt: number;
}

const STORAGE_KEY = 'nerve.wishlist.shares';
const SHARE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createWishlistShare(productSlugs: string[], message: string = ''): SharedWishlist {
  const code = generateShareCode();
  const now = Date.now();
  const share: SharedWishlist = {
    code,
    items: productSlugs,
    message,
    createdAt: now,
    expiresAt: now + SHARE_DURATION_MS,
  };

  try {
    const shares = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<
      string,
      SharedWishlist
    >;
    shares[code] = share;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
  } catch {
    // Silent fail
  }

  return share;
}

export function getSharedWishlist(code: string): SharedWishlist | null {
  try {
    const shares = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<
      string,
      SharedWishlist
    >;
    const share = shares[code];

    if (!share) return null;

    // Check if expired
    if (share.expiresAt < Date.now()) {
      delete shares[code];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
      return null;
    }

    return share;
  } catch {
    return null;
  }
}

export const wishlistShareService = {
  generateShareCode,
  createWishlistShare,
  getSharedWishlist,
};
