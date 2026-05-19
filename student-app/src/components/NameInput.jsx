// Phase 2 新增：学生加入页面
import { useState } from 'react';
import Button from './Button';

export default function NameInput({ sessionName, onSubmit }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Welcome!</h1>
          {sessionName && (
            <p className="text-slate-500">{sessionName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              What's your name?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-4 border-4 border-slate-200 rounded-2xl focus:border-indigo-500 focus:outline-none text-lg font-bold"
              placeholder="Type your name..."
              autoFocus
            />
          </div>

          <Button
            type="submit"
            disabled={!name.trim()}
            className="w-full"
            size="lg"
          >
            Join Class
          </Button>
        </form>
      </div>
    </div>
  );
}
