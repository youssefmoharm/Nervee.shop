import { logError } from '../lib/sentry';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { GuestOrder } from '../types';

export interface GuestOrderLookup {
  email: string;
  orderNumber: string;
  verificationToken?: string;
}

export const guestOrderService = {
  /**
   * Lookup a guest order by email and order number
   */
  async lookup(email: string, orderNumber: string, verificationToken?: string) {
    if (!isSupabaseConfigured) {
      return { order: null, error: 'Supabase not configured' };
    }

    try {
      let query = supabase
        .from('guest_orders')
        .select('*')
        .eq('email', email)
        .eq('order_number', orderNumber);

      if (verificationToken) {
        query = query.eq('verification_token', verificationToken);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return { order: null, error: 'Order not found' };
      }

      return { order: data as GuestOrder, error: null };
    } catch (err) {
      logError('guestOrderService.lookup failed:', err);
      return { order: null, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Create a guest order record
   */
  async create(email: string, orderNumber: string, verificationToken: string) {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('guest_orders')
        .insert({
          email,
          order_number: orderNumber,
          verification_token: verificationToken,
        })
        .select()
        .single();

      if (error) {
        logError('Error creating guest order:', error);
        return { success: false, error: error.message };
      }

      return { success: true, order: data as GuestOrder, error: null };
    } catch (err) {
      logError('guestOrderService.create failed:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  /**
   * Send verification link via email
   */
  async sendVerificationLink(email: string, orderNumber: string, verificationToken: string) {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      // Check if guest order exists
      const { order, error } = await this.lookup(email, orderNumber, verificationToken);

      if (error || !order) {
        return { success: false, error: 'Order not found' };
      }

      // Construct verification URL
      const siteUrl = import.meta.env.VITE_SITE_URL || 'https://your-site.com';
      const verificationUrl = `${siteUrl}/guest-order?token=${verificationToken}&email=${email}&orderNumber=${orderNumber}`;

      // In production, this would send an actual email via Resend
      // For now, we'll return the URL that should be sent in email
      return {
        success: true,
        verificationUrl,
        error: null,
      };
    } catch (err) {
      logError('guestOrderService.sendVerificationLink failed:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },
};
