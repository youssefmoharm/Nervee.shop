import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logError } from '../lib/sentry';
import type { ProductReview } from '../types';

export interface ReviewInput {
  productId: string;
  rating: number;
  title: string;
  comment?: string;
  photos?: string[];
}

const VOTER_ID_KEY = 'nerve.voter_id';
const VOTED_KEY_PREFIX = 'nerve.voted_reviews.';

function getVoterId(): string {
  let id = localStorage.getItem(VOTER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VOTER_ID_KEY, id);
  }
  return id;
}

function getVotedIds(productId: string): Set<string> {
  try {
    const raw = localStorage.getItem(VOTED_KEY_PREFIX + productId);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function addVotedId(productId: string, reviewId: string) {
  const set = getVotedIds(productId);
  set.add(reviewId);
  localStorage.setItem(VOTED_KEY_PREFIX + productId, JSON.stringify([...set]));
}

export const reviewService = {
  /**
   * Get reviews for a product
   */
  async getByProduct(productId: string) {
    if (!isSupabaseConfigured) {
      return { reviews: [], error: 'Supabase not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select(
          `
          id,
          product_id,
          customer_id,
          rating,
          title,
          comment,
          photos,
          helpful_count,
          verified,
          created_at,
          customers (
            first_name,
            last_name
          )
        `,
        )
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        logError('Error fetching reviews:', error);
        return { reviews: [], error: error.message };
      }

      const reviews = (data || []).map(r => ({
        id: r.id,
        productId: r.product_id,
        customerId: r.customer_id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        photos: Array.isArray(r.photos) ? r.photos : [],
        helpfulCount: typeof r.helpful_count === 'number' ? r.helpful_count : 0,
        verified: r.verified,
        createdAt: r.created_at,
        customerName: r.customers?.[0]
          ? `${r.customers[0].first_name} ${r.customers[0].last_name}`
          : undefined,
      }));

      return { reviews, error: null };
    } catch (err) {
      logError('reviewService.getByProduct failed:', err);
      return { reviews: [], error: 'Network error. Please try again.' };
    }
  },

  /**
   * Get review stats for a product
   */
  async getStats(productId: string) {
    if (!isSupabaseConfigured) {
      return { stats: null, error: 'Supabase not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('product_review_stats')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (error || !data) {
        return {
          stats: { productId, reviewCount: 0, averageRating: 0 },
          error: null,
        };
      }

      return {
        stats: {
          productId: data.product_id,
          reviewCount: data.review_count,
          averageRating: data.average_rating,
        },
        error: null,
      };
    } catch (err) {
      logError('reviewService.getStats failed:', err);
      return { stats: null, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Create a review for a product
   */
  async create(input: ReviewInput) {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError || !user.user) {
        return { success: false, error: 'You must be logged in to submit a review' };
      }

      const { data, error } = await supabase
        .from('product_reviews')
        .insert({
          product_id: input.productId,
          customer_id: user.user.id,
          rating: input.rating,
          title: input.title,
          comment: input.comment,
          photos: input.photos ?? [],
        })
        .select()
        .single();

      if (error) {
        logError('Error creating review:', error);
        if (error.message.includes('duplicate key')) {
          return { success: false, error: 'You have already reviewed this product' };
        }
        return { success: false, error: error.message };
      }

      return { success: true, review: data as ProductReview, error: null };
    } catch (err) {
      logError('reviewService.create failed:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Update a review
   */
  async update(reviewId: string, input: Partial<ReviewInput>) {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError || !user.user) {
        return { success: false, error: 'You must be logged in to update a review' };
      }

      // Check ownership
      const { data: existing, error: fetchError } = await supabase
        .from('product_reviews')
        .select('customer_id')
        .eq('id', reviewId)
        .single();

      if (fetchError || !existing || existing.customer_id !== user.user.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const { error } = await supabase
        .from('product_reviews')
        .update({
          rating: input.rating,
          title: input.title,
          comment: input.comment,
        })
        .eq('id', reviewId);

      if (error) {
        logError('Error updating review:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      logError('reviewService.update failed:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Delete a review
   */
  async delete(reviewId: string) {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError || !user.user) {
        return { success: false, error: 'You must be logged in to delete a review' };
      }

      // Check ownership
      const { data: existing, error: fetchError } = await supabase
        .from('product_reviews')
        .select('customer_id')
        .eq('id', reviewId)
        .single();

      if (fetchError || !existing || existing.customer_id !== user.user.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const { error } = await supabase.from('product_reviews').delete().eq('id', reviewId);

      if (error) {
        logError('Error deleting review:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      logError('reviewService.delete failed:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Verify a purchase for a review
   */
  async verifyPurchase(reviewId: string) {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase.rpc('verify_review_purchase', { p_review_id: reviewId });

      if (error) {
        logError('Error verifying purchase:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      logError('reviewService.verifyPurchase failed:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  hasVoted(productId: string, reviewId: string): boolean {
    return getVotedIds(productId).has(reviewId);
  },

  /**
   * Cast a helpful vote for a review.
   * Returns the server-authoritative `count` so the UI can render the
   * persisted helpful_count (not an optimistic guess). `voted` is false
   * when this voter already voted (count unchanged).
   */
  async voteHelpful(
    productId: string,
    reviewId: string,
  ): Promise<{ voted: boolean; count?: number; error?: string }> {
    if (!isSupabaseConfigured) {
      return { voted: false, error: 'Voting is not available right now.' };
    }

    if (this.hasVoted(productId, reviewId)) {
      return { voted: false, error: undefined };
    }

    try {
      const { data, error } = await supabase.rpc('vote_review_helpful', {
        p_review_id: reviewId,
        p_voter_id: getVoterId(),
      });

      if (error) {
        logError('reviewService.voteHelpful failed:', error);
        return { voted: false, error: 'Could not record your vote. Please try again.' };
      }

      addVotedId(productId, reviewId);
      const count = typeof data === 'number' ? data : Number(data);
      return { voted: Number.isFinite(count), count: Number.isFinite(count) ? count : undefined };
    } catch (err) {
      logError('reviewService.voteHelpful failed:', err);
      return { voted: false, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Upload review photos to the review-photos bucket.
   * Returns public URLs for successes; failures are reported in `failed`.
   */
  async uploadPhotos(
    customerId: string,
    files: File[],
  ): Promise<{ urls: string[]; failed: number }> {
    const urls: string[] = [];
    if (files.length === 0) return { urls, failed: 0 };

    const uploads = await Promise.allSettled(
      files.map(async file => {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${customerId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from('review-photos')
          .upload(path, file, { contentType: file.type || 'image/jpeg' });
        if (error) throw error;
        const { data } = supabase.storage.from('review-photos').getPublicUrl(path);
        return data.publicUrl;
      }),
    );

    let failed = 0;
    uploads.forEach(result => {
      if (result.status === 'fulfilled') urls.push(result.value);
      else failed += 1;
    });

    return { urls, failed };
  },
};
