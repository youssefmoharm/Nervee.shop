import { useState } from 'react';
import { X, Copy, Mail } from 'lucide-react';
import { createWishlistShare } from '../services/wishlistShareService';
import Button from './Button';
import { useToast } from '../context/ToastContext';

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
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleGenerateShare = () => {
    if (wishlistSlugs.length === 0) {
      showToast('Add items to your wishlist first', 'error');
      return;
    }
    const share = createWishlistShare(wishlistSlugs, message);
    setShareCode(share.code);
    showToast('Share link created!', 'success');
  };

  const shareUrl = shareCode ? `${window.location.origin}/wishlist/${shareCode}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('Link copied to clipboard!', 'success');
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
      showToast('Link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmailShare = () => {
    if (!email) {
      showToast('Please enter an email address', 'error');
      return;
    }
    // Mock email send (would integrate with backend in production)
    console.log(`Sending wishlist to ${email}: ${shareUrl}`);
    showToast(`Share link would be sent to ${email}`, 'success');
    handleClose();
  };

  const handleClose = () => {
    setShareCode(null);
    setMessage('');
    setEmail('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy/10">
          <h2 className="text-xl font-bold text-navy">Share Your Wishlist</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-navy/10 rounded-full transition-colors"
            aria-label="Close"
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
                  Share your wishlist ({wishlistCount} items) with friends and family
                </p>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Add a personal message (optional)"
                  className="w-full border border-navy/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy transition-colors resize-none"
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-navy/50 mt-1">{message.length}/200 characters</p>
              </div>
              <Button onClick={handleGenerateShare} className="w-full">
                Generate Share Link
              </Button>
            </>
          ) : (
            <>
              <div className="bg-mist rounded-lg p-4">
                <p className="text-xs text-navy/60 mb-2">Share Link</p>
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
                    title={copied ? 'Copied!' : 'Copy to clipboard'}
                  >
                    <Copy size={16} className={copied ? 'text-green-600' : 'text-navy'} />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-navy/60 mb-2">Or share via email</p>
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
                    className="p-2 hover:bg-navy/10 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Mail size={16} className="text-navy" />
                  </button>
                </div>
              </div>

              <Button onClick={handleClose} variant="outline" className="w-full">
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
