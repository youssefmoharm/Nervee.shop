/**
 * Language Switcher Component
 * 
 * Allows users to switch between English and Arabic languages.
 * Updates the document direction (RTL/LTR) automatically.
 */

import { useState, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation, SUPPORTED_LANGUAGES, getDirection } from '../lib/i18n';

export default function LanguageSwitcher() {
  const { i18n, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === language);

  // Update document direction when language changes
  useEffect(() => {
    document.documentElement.dir = getDirection(language);
    document.documentElement.lang = language;
  }, [language]);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-navy hover:bg-navy/10 rounded-md transition-colors"
        aria-label="Switch language"
      >
        <Globe size={16} />
        {currentLang?.nativeName || language}
        <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-navy/10 rounded-lg shadow-lg py-2 z-50">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-navy/5 flex items-center justify-between"
            >
              <span>{lang.nativeName}</span>
              {lang.code === language && <Check size={14} className="text-green-600" />}
            </button>
          ))}
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
