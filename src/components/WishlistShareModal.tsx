import { useEffect, useState } from 'react';
import { X, Copy, Mail } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import { createShare } from '../services/wishlistShareService';
import Button from './Button';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../lib/i18n';

interface WishlistShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistSlugs: string[];
  wishlistCount: number;
}

export default function WishlistShareModal({
  isOpen,
  onClose,
  wishlistSlugs,
  wishlistCount,
}: WishlistShareModalProps) {
  const { t } = useI18n();
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const handleClose = () => {
    setShareCode(null);
    setMessage('');
    setEmail('');
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGenerateShare = async () => {
    if (wishlistSlugs.length === 0) {
      showToast(t('Add items to your wishlist first'), 'error');
      return;
    }
    setCreating(true);
    const result = await createShare(wishlistSlugs, message);
    setCreating(false);
    if ('error' in result) {
      showToast(result.error, 'error');
      return;
    }
    setShareCode(result.share.code);
    showToast(t('Share link created!'), 'success');
  };

  const shareUrl = shareCode ? `${window.location.origin}/wishlist/${shareCode}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast(t('Link copied to clipboard!'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      showToast(t('Link copied to clipboard!'), 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmailShare = () => {
    if (!email) {
      showToast(t('Please enter an email address'), 'error');
      return;
    }
    // Email share would be sent via backend in production
    showToast(`${t('Share link would be sent to')} ${email}`, 'success');
    handleClose();
  };

  return (
    <FocusTrap active onClickOutside={handleClose}>
      <div className="contents">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wishlist-share-title"
            className="bg-white rounded-lg w-full max-w-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-navy/10">
              <h2 id="wishlist-share-title" className="text-xl font-bold text-navy">
                {t('Share Your Wishlist')}
              </h2>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-navy/10 rounded-full transition-colors"
                aria-label={t('Close')}
              >
                <X size={24} className="text-navy" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {!shareCode ? (
                <>
                  <div>
                    <p className="text-sm text-navy/70 mb-3">
                      {t('Share your wishlist')} ({wishlistCount} {t('items')}){' '}
                      {t('with friends and family')}
                    </p>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={t('Add a personal message (optional)')}
                      className="w-full border border-navy/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy transition-colors resize-none"
                      rows={3}
                      maxLength={200}
                    />
                    <p className="text-xs text-navy/60 mt-1">
                      {message.length}/200 {t('characters')}
                    </p>
                  </div>
                  <Button onClick={handleGenerateShare} disabled={creating} className="w-full">
                    {creating ? t('Creating link…') : t('Generate Share Link')}
                  </Button>
                </>
              ) : (
                <>
                  <div className="bg-mist rounded-lg p-4">
                    <p className="text-xs text-navy/60 mb-2">{t('Share Link')}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 bg-white border border-navy/20 rounded px-3 py-2 text-xs font-mono"
                      />
                      <button
                        onClick={handleCopy}
                        className="p-2 hover:bg-navy/10 rounded transition-colors"
                        title={copied ? t('Copied!') : t('Copy to clipboard')}
                      >
                        <Copy size={16} className={copied ? 'text-green-600' : 'text-navy'} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-navy/60 mb-2">{t('Or share via email')}</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="recipient@email.com"
                        className="flex-1 border border-navy/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy transition-colors"
                      />
                      <button
                        onClick={handleEmailShare}
                        disabled={!email}
                        aria-label={t('Send share link by email')}
                        className="p-2 hover:bg-navy/10 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Mail size={16} className="text-navy" />
                      </button>
                    </div>
                  </div>

                  <Button onClick={handleClose} variant="outline" className="w-full">
                    {t('Done')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
