import { Facebook, Twitter, Instagram, Share2 } from 'lucide-react';

interface SocialShareProps {
  url?: string;
  title?: string;
}

export function SocialShare({
  url = window.location.href,
  title = document.title,
}: SocialShareProps) {
  const handleShare = (platform: string) => {
    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
          url,
        )}&text=${encodeURIComponent(title)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`;
        break;
      case 'instagram':
        window.open('https://www.instagram.com/', '_blank');
        return;
      default:
        return;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-navy/60 mr-2">Share:</span>

      <button
        onClick={() => handleShare('facebook')}
        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
        aria-label="Share on Facebook"
      >
        <Facebook size={20} />
      </button>

      <button
        onClick={() => handleShare('twitter')}
        className="text-sky-500 hover:text-sky-600 hover:bg-sky-50 p-2 rounded-lg transition-colors"
        aria-label="Share on Twitter"
      >
        <Twitter size={20} />
      </button>

      <button
        onClick={() => handleShare('whatsapp')}
        className="text-green-500 hover:text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors"
        aria-label="Share on WhatsApp"
      >
        <Share2 size={20} />
      </button>

      <button
        onClick={() => handleShare('instagram')}
        className="text-pink-600 hover:text-pink-700 hover:bg-pink-50 p-2 rounded-lg transition-colors"
        aria-label="Share on Instagram"
      >
        <Instagram size={20} />
      </button>
    </div>
  );
}
