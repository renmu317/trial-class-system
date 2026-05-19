// 学生输入短码加入课堂
import { useState } from 'react';
import Button from './Button';

export default function CodeInput({ onSubmit, error }) {
  const [code, setCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim().length >= 4) {
      onSubmit(code.trim());
    }
  };

  const handleChange = (e) => {
    // Only allow digits, max 4 characters
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCode(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Join Class</h1>
          <p className="text-slate-500">Enter the code from your teacher</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={handleChange}
              className="w-full px-4 py-6 border-4 border-slate-200 rounded-2xl focus:border-indigo-500 focus:outline-none text-4xl font-bold text-center tracking-[0.5em]"
              placeholder="0000"
              autoFocus
              maxLength={4}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={code.length < 4}
            className="w-full"
            size="lg"
          >
            Join
          </Button>
        </form>
      </div>
    </div>
  );
}
