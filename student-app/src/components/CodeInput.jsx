// 学生输入短码加入课堂
// 支持 4 位 session code 或 6 位 student shortcode
import { useState } from 'react';
import { useT } from '../i18n';
import Button from './Button';

export default function CodeInput({ onSubmit, error, loading }) {
  const t = useT();
  const [code, setCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim().length >= 4) {
      onSubmit(code.trim());
    }
  };

  const handleChange = (e) => {
    // Only allow digits, max 6 characters (4 for session, 6 for shortcode)
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const isShortcode = code.length === 6;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">{t('codeInput.title')}</h1>
          <p className="text-slate-500">{t('codeInput.enterCode')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={handleChange}
              className={`w-full px-4 py-6 border-4 rounded-2xl focus:outline-none text-4xl font-bold text-center ${
                isShortcode
                  ? 'border-green-300 focus:border-green-500 tracking-[0.3em]'
                  : 'border-slate-200 focus:border-indigo-500 tracking-[0.5em]'
              }`}
              placeholder="0000"
              autoFocus
              maxLength={6}
            />
            {isShortcode && (
              <p className="text-center text-green-600 text-sm mt-2">
                ✓ {t('codeInput.shortcodeDetected')}
              </p>
            )}
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={code.length < 4 || loading}
            className="w-full"
            size="lg"
          >
            {loading ? t('codeInput.joining') : t('codeInput.submit')}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          {t('codeInput.codeHint')}
        </p>
      </div>
    </div>
  );
}
