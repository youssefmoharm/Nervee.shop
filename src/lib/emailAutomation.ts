/**
 * Email Automation Service
 *
 * Handles cart abandonment, marketing emails, and transactional messages
 * Integrates with Supabase Edge Functions for secure email sending
 */

import { supabase } from './supabase';
import { logError } from './sentry';
import type { CartLine } from '../types';

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

interface CartAbandonmentData {
  customerEmail: string;
  customerName?: string;
  cartItems: CartLine[];
  cartValue: number;
  recoveryUrl: string;
}

interface NewsletterData {
  email: string;
  firstName?: string;
  preferences?: string[];
}

interface BackInStockData {
  customerEmail: string;
  customerName?: string;
  productName: string;
  productUrl: string;
  productImage: string;
  price: number;
}

class EmailAutomationService {
  // Call Edge Function to send emails securely (server-side)
  private async sendEmailViaEdgeFunction(
    to: string,
    subject: string,
    html: string,
    emailType: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          html,
          type: emailType,
          metadata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logError('Email send failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      logError('Failed to call send-email function:', error);
      return false;
    }
  }

  // Send cart abandonment email
  async sendCartAbandonmentEmail(data: CartAbandonmentData): Promise<boolean> {
    try {
      const template = this.getCartAbandonmentTemplate(data);

      const success = await this.sendEmailViaEdgeFunction(
        data.customerEmail,
        template.subject,
        template.html,
        'cart_abandonment',
        {
          cart_value: data.cartValue,
          item_count: data.cartItems.length,
        },
      );

      if (success) {
        // Track the email send
        this.trackEmailEvent('cart_abandonment_sent', {
          customer_email: data.customerEmail,
          cart_value: data.cartValue,
          item_count: data.cartItems.length,
        });

        // Record cart abandonment in database for tracking
        await this.recordCartAbandonment(data.customerEmail, data.cartItems, data.cartValue);
      } else {
        this.trackEmailEvent('cart_abandonment_failed', {
          customer_email: data.customerEmail,
        });
      }

      return success;
    } catch (error) {
      logError('Cart abandonment email failed:', error);
      this.trackEmailEvent('cart_abandonment_failed', {
        customer_email: data.customerEmail,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Send welcome email for new subscribers
  async sendWelcomeEmail(email: string, firstName?: string): Promise<boolean> {
    try {
      const template = this.getWelcomeTemplate(firstName);

      const success = await this.sendEmailViaEdgeFunction(
        email,
        template.subject,
        template.html,
        'welcome',
      );

      return success;
    } catch (error) {
      logError('Welcome email failed:', error);
      return false;
    }
  }

  // Send back-in-stock notification
  async sendBackInStockEmail(data: BackInStockData): Promise<boolean> {
    try {
      const template = this.getBackInStockTemplate(data);

      const success = await this.sendEmailViaEdgeFunction(
        data.customerEmail,
        template.subject,
        template.html,
        'back_in_stock',
        {
          product_name: data.productName,
          price: data.price,
        },
      );

      return success;
    } catch (error) {
      logError('Back in stock email failed:', error);
      return false;
    }
  }

  // Newsletter signup
  async subscribeToNewsletter(data: NewsletterData): Promise<boolean> {
    try {
      // Add to newsletter subscribers table
      const { error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert({
          email: data.email,
          first_name: data.firstName,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        // If subscriber already exists, just reactivate
        if (insertError.message.includes('duplicate')) {
          const { error: updateError } = await supabase
            .from('newsletter_subscribers')
            .update({ is_active: true })
            .eq('email', data.email);

          if (updateError) {
            logError('Failed to reactivate subscription:', updateError);
            return false;
          }
        } else {
          logError('Failed to add to newsletter:', insertError);
          return false;
        }
      }

      // Send welcome email
      await this.sendWelcomeEmail(data.email, data.firstName);
      return true;
    } catch (error) {
      logError('Newsletter subscription failed:', error);
      return false;
    }
  }

  // Request back-in-stock notification
  async requestBackInStockNotification(
    productId: string,
    customerEmail: string,
    size?: string,
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('back_in_stock_requests')
        .insert({
          product_id: productId,
          customer_email: customerEmail,
          size: size || null,
        })
        .select()
        .single();

      if (error) {
        logError('Failed to request back-in-stock notification:', error);
        return false;
      }

      this.trackEmailEvent('back_in_stock_request', {
        product_id: productId,
        customer_email: customerEmail,
        size: size || 'any',
      });

      return true;
    } catch (error) {
      logError('Back-in-stock request failed:', error);
      return false;
    }
  }

  // Record cart abandonment for tracking (used by cron job to send emails)
  private async recordCartAbandonment(
    customerEmail: string,
    cartItems: CartLine[],
    cartValue: number,
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('cart_abandonment_tracking')
        .upsert({
          customer_email: customerEmail,
          cart_items: JSON.parse(JSON.stringify(cartItems)),
          cart_value: cartValue,
          last_activity_at: new Date().toISOString(),
        })
        .eq('customer_email', customerEmail);

      if (error) {
        logError('Failed to record cart abandonment:', error);
      }
    } catch (error) {
      logError('Error recording cart abandonment:', error);
    }
  }

  // Generate unsubscribe link for email
  async getUnsubscribeLink(email: string, emailType?: string): Promise<string> {
    try {
      const token = await supabase.rpc('create_unsubscribe_token', {
        p_email: email,
        p_email_type: emailType || null,
      });

      if (token.error) {
        logError('Failed to create unsubscribe token:', token.error);
        return ''; // Fallback to empty link if token creation fails
      }

      const storeUrl = import.meta.env.VITE_APP_URL || 'https://nerve-store.com';
      return `${storeUrl}/unsubscribe?token=${token.data}`;
    } catch (error) {
      logError('Error getting unsubscribe link:', error);
      return '';
    }
  }

  // Check if email should receive emails
  async shouldSendEmail(email: string): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('should_send_email', {
        p_email: email,
      });

      return data === true;
    } catch (error) {
      logError('Error checking email status:', error);
      return false;
    }
  }

  // Track cart activity for abandonment detection
  async trackCartActivity(
    customerEmail: string,
    cartItems: CartLine[],
    cartValue: number,
  ): Promise<void> {
    try {
      // Update or insert cart abandonment tracking
      const { error } = await supabase.from('cart_abandonment_tracking').upsert(
        {
          customer_email: customerEmail,
          cart_items: JSON.parse(JSON.stringify(cartItems)),
          cart_value: cartValue,
          last_activity_at: new Date().toISOString(),
        },
        {
          onConflict: 'customer_email',
        },
      );

      if (error) {
        logError('Failed to track cart activity:', error);
      }
    } catch (error) {
      logError('Error tracking cart activity:', error);
    }
  }

  // Mark cart as recovered (order placed)
  async markCartAsRecovered(customerEmail: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('mark_cart_abandonment_recovered', {
        p_customer_email: customerEmail,
      });

      if (error) {
        logError('Failed to mark cart as recovered:', error);
      }
    } catch (error) {
      logError('Error marking cart as recovered:', error);
    }
  }

  // Email templates
  private getCartAbandonmentTemplate(data: CartAbandonmentData): EmailTemplate {
    const itemsHtml = data.cartItems
      .map(
        item => `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #eee;">
          <img src="${item.image}" alt="${
          item.name
        }" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
        </td>
        <td style="padding: 15px; border-bottom: 1px solid #eee;">
          <h3 style="margin: 0; font-size: 16px;">${item.name}</h3>
          <p style="margin: 5px 0; color: #666;">Size: ${item.size}</p>
          <p style="margin: 5px 0; color: #666;">Quantity: ${item.quantity}</p>
        </td>
        <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: right;">
          <strong>EGP ${(item.price * item.quantity).toLocaleString()}</strong>
        </td>
      </tr>
    `,
      )
      .join('');

    return {
      subject: `You left ${data.cartItems.length} item${
        data.cartItems.length > 1 ? 's' : ''
      } in your cart ✨`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Complete Your Purchase</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #061735 0%, #1a365d 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Don't miss out! ⏰</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your items are waiting for you</p>
            </div>

            <!-- Content -->
            <div style="padding: 30px;">
              <p style="font-size: 18px; margin-bottom: 20px;">
                Hi ${data.customerName || 'there'}! 👋
              </p>
              
              <p style="margin-bottom: 25px;">
                You left <strong>${data.cartItems.length} awesome item${
        data.cartItems.length > 1 ? 's' : ''
      }</strong> 
                worth <strong>EGP ${data.cartValue.toLocaleString()}</strong> in your bag.
              </p>

              <!-- Cart Items -->
              <table style="width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                ${itemsHtml}
                <tr>
                  <td colspan="2" style="padding: 20px; font-weight: 600; font-size: 18px; text-align: right; background: #f8f9fa;">
                    Total: EGP ${data.cartValue.toLocaleString()}
                  </td>
                </tr>
              </table>

              <!-- Special Offer -->
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                <h3 style="margin: 0; font-size: 20px;">Special Offer Just for You! 🎉</h3>
                <p style="margin: 10px 0; font-size: 16px;">Complete your purchase in the next 24 hours and get <strong>10% OFF</strong></p>
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">Use code: <strong>COMEBACK10</strong></p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${
                  data.recoveryUrl
                }" style="background: #061735; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; transition: all 0.2s;">
                  Complete Your Purchase →
                </a>
              </div>

              <!-- Why NERVE -->
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h4 style="margin: 0 0 15px 0; color: #061735;">Why choose NERVE?</h4>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>✅ Free delivery across Egypt</li>
                  <li>✅ 14-day easy returns</li>
                  <li>✅ Premium quality guaranteed</li>
                  <li>✅ Sustainable materials</li>
                </ul>
              </div>

              <!-- Footer Message -->
              <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
                This offer expires in 24 hours. Don't miss out on your perfect style! ⏰
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
              <p style="margin: 0;">NERVE - Cool but Chic | Cairo, Egypt</p>
              <p style="margin: 5px 0 0 0;">
                <a href="#" style="color: #061735; text-decoration: none;">Unsubscribe</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${data.customerName || 'there'}! You left ${
        data.cartItems.length
      } items worth EGP ${data.cartValue.toLocaleString()} in your cart. Complete your purchase now and get 10% off with code COMEBACK10: ${
        data.recoveryUrl
      }`,
    };
  }

  private getWelcomeTemplate(firstName?: string): EmailTemplate {
    return {
      subject: '🎉 Welcome to NERVE - Your style journey starts now!',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #061735 0%, #1a365d 100%); color: white; padding: 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px;">Welcome to NERVE! 🎉</h1>
              <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Cool but Chic - Your style destination</p>
            </div>
            
            <div style="padding: 30px;">
              <p style="font-size: 18px;">Hi ${firstName || 'Stylish One'}! 👋</p>
              
              <p>Welcome to the NERVE family! We're thrilled to have you join our community of style-conscious individuals who appreciate quality, comfort, and that perfect chic vibe.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #061735;">What makes NERVE special?</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>🎨 Carefully curated streetwear collection</li>
                  <li>🌱 Sustainable and premium materials</li>
                  <li>🚚 Free delivery across Egypt</li>
                  <li>↩️ 14-day hassle-free returns</li>
                  <li>💬 24/7 customer support</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${
                  window.location.origin
                }/shop" style="background: #061735; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                  Start Shopping →
                </a>
              </div>
              
              <p style="text-align: center; color: #666;">Follow us for style inspiration and exclusive offers!</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to NERVE! We're excited to have you join our community. Start shopping: ${window.location.origin}/shop`,
    };
  }

  private getBackInStockTemplate(data: BackInStockData): EmailTemplate {
    return {
      subject: `🔥 ${data.productName} is back in stock!`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">It's Back! 🔥</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">The item you were waiting for</p>
            </div>
            
            <div style="padding: 30px; text-align: center;">
              <img src="${data.productImage}" alt="${
        data.productName
      }" style="width: 200px; height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 20px;">
              
              <h2 style="margin: 0; color: #061735;">${data.productName}</h2>
              <p style="font-size: 24px; color: #f5576c; font-weight: 600; margin: 10px 0;">EGP ${data.price.toLocaleString()}</p>
              
              <p>Hi ${
                data.customerName || 'there'
              }! Great news - the item you requested is now back in stock and ready to ship.</p>
              
              <div style="margin: 30px 0;">
                <a href="${
                  data.productUrl
                }" style="background: #061735; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                  Shop Now →
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">⏰ Limited stock - don't wait too long!</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `${data.productName} is back in stock! Shop now: ${data.productUrl}`,
    };
  }

  // Track email events for analytics
  private trackEmailEvent(eventName: string, data: Record<string, any>) {
    // This would integrate with your analytics system
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, data);
    }
  }
}

// Global instance
export const emailAutomation = new EmailAutomationService();

// React hook for cart abandonment tracking
export function useCartAbandonmentTracking() {
  return {
    trackCartActivity: (customerEmail: string, cartItems: CartLine[], cartValue: number) => {
      emailAutomation.trackCartActivity(customerEmail, cartItems, cartValue);
    },

    markCartAsRecovered: (customerEmail: string) => {
      emailAutomation.markCartAsRecovered(customerEmail);
    },
  };
}

// Utility functions
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function getOptimalSendTime(): number {
  // Send emails at optimal times (10 AM local time)
  const now = new Date();
  const optimal = new Date();
  optimal.setHours(10, 0, 0, 0);

  // If it's past 10 AM today, schedule for 10 AM tomorrow
  if (now.getTime() > optimal.getTime()) {
    optimal.setDate(optimal.getDate() + 1);
  }

  return optimal.getTime();
}
