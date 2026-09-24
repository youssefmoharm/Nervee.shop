import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getEndpoint } from '../lib/apiEndpoints';
import { logError } from '../lib/sentry';
import { useSEO } from '../hooks/useSEO';
import { useI18n } from '../lib/i18n';

type Status = 'loading' | 'success' | 'error' | 'resubscribe';

interface UnsubscribeResult {
  success: boolean;
  email?: string;
  unsubscribed_from?: string;
  message?: string;
  error?: string;
}

export default function Unsubscribe() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<UnsubscribeResult | null>(null);
  const [feedback, setFeedback] = useState('');

  useSEO({
    title: 'Unsubscribe — NERVE',
    description: 'Manage email preferences for the NERVE newsletter.',
    robots: 'noindex, nofollow',
  });

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setResult({ success: false, error: 'Invalid or missing unsubscribe link' });
      return;
    }

    processUnsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const processUnsubscribe = async () => {
    try {
      const response = await fetch(getEndpoint('HANDLE_UNSUBSCRIBE'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          reason: null,
        }),
      });

      const data: UnsubscribeResult = await response.json();

      if (data.success) {
        setResult(data);
        setStatus('success');
      } else {
        setResult(data);
        setStatus('error');
      }
    } catch (error) {
      logError('Unsubscribe error:', error);
      setResult({
        success: false,
        error: 'Something went wrong. Please try again later.',
      });
      setStatus('error');
    }
  };

  const handleResubscribe = async () => {
    if (!result?.email) return;

    try {
      const { error } = await supabase.from('newsletter_subscribers').upsert(
        {
          email: result.email,
          is_active: true,
        },
        { onConflict: 'email' },
      );

      if (error) {
        logError('Resubscribe error:', error);
        return;
      }

      setStatus('resubscribe');
    } catch (err) {
      logError('Resubscribe failed:', err);
    }
  };

  const handleFeedback = async () => {
    if (!result?.email || !feedback) return;

    try {
      await supabase.from('unsubscribe_audit_log').insert({
        email: result.email,
        unsubscribe_type: 'all',
        unsubscribe_method: 'feedback',
        reason: feedback,
      });

      // Show thank you after feedback
      setFeedback('');
    } catch (err) {
      logError('Feedback error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy to-navy-2 flex items-center justify-center px-4 py-12">
      {/* White card on a navy page: states its own foreground. */}
      <div className="max-w-md w-full bg-white text-navy rounded-lg shadow-xl p-8">
        {/* Loading State */}
        {status === 'loading' && (
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
            </div>
            <p className="mt-4 text-gray-600">{t('Processing your request...')}</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h1 className="text-2xl font-bold text-navy">{t("You've been unsubscribed")}</h1>
            <p className="text-gray-600">
              {t("We've removed")} <span className="font-semibold">{result?.email}</span>{' '}
              {t('from our email list.')}
            </p>

            {/* Feedback Section */}
            <div className="mt-8 space-y-3 border-t pt-6">
              <p className="text-sm text-gray-600 font-medium">
                {t("We'd love to know why you're leaving:")}
              </p>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder={t('Optional: Tell us what we could improve...')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-navy resize-none"
                rows={3}
              />
              {feedback && (
                <button
                  onClick={handleFeedback}
                  className="w-full bg-navy text-white py-2 rounded-lg hover:bg-navy-2 transition text-sm font-medium"
                >
                  {t('Send Feedback')}
                </button>
              )}
            </div>

            {/* Resubscribe Option */}
            <div className="border-t pt-6 space-y-3">
              <p className="text-sm text-gray-600">
                {t('Changed your mind? You can resubscribe anytime:')}
              </p>
              <button
                onClick={handleResubscribe}
                className="w-full bg-white border-2 border-navy text-navy py-2 rounded-lg hover:bg-navy hover:text-white transition font-medium"
              >
                {t('Resubscribe to Newsletter')}
              </button>
            </div>

            {/* Contact Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                {t('Questions? Contact us at')}{' '}
                <a
                  href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'nerveey.shop@gmail.com'}`}
                  className="text-navy font-semibold"
                >
                  {import.meta.env.VITE_SUPPORT_EMAIL || 'nerveey.shop@gmail.com'}
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-2xl font-bold text-red-600">{t('Invalid Link')}</h1>
            <p className="text-gray-600">
              {result?.error || t('This unsubscribe link is invalid or has expired.')}
            </p>

            <div className="border-t pt-6 space-y-3">
              <p className="text-sm text-gray-600">{t('Need help?')}</p>
              <a
                href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'nerveey.shop@gmail.com'}`}
                className="block w-full bg-navy text-white py-2 rounded-lg hover:bg-navy-2 transition text-center font-medium"
              >
                {t('Contact Support')}
              </a>
              <a href="/" className="block text-navy hover:underline text-center text-sm">
                {t('Back to Home')}
              </a>
            </div>
          </div>
        )}

        {/* Resubscribe Success State */}
        {status === 'resubscribe' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <h1 className="text-2xl font-bold text-navy">{t('Welcome back!')}</h1>
            <p className="text-gray-600">
              {t("You've been resubscribed to our newsletter. Expect to hear from us soon!")}
            </p>

            <div className="border-t pt-6">
              <a
                href="/"
                className="block w-full bg-navy text-white py-2 rounded-lg hover:bg-navy-2 transition text-center font-medium"
              >
                {t('Return to Store')}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
