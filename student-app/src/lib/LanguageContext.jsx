// Language Context - Provides app-wide language switching
import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // Initialize from localStorage or default to 'en'
    return localStorage.getItem('language') || 'en';
  });

  // Persist language choice to localStorage
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Language toggle button component
export function LanguageToggle({ className = '' }) {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className={`px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-sm font-medium transition-colors ${className}`}
      title={language === 'en' ? 'Switch to Chinese' : 'Switch to English'}
    >
      {language === 'en' ? '中文' : 'EN'}
    </button>
  );
}
