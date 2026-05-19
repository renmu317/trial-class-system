// Phase 1 原版 OwnIdeaInput - 不要修改
import { useState } from 'react';
import Button from './Button';

export default function OwnIdeaInput({ stepLabel, currentValue, maxLength, onSubmit, onCancel }) {
  const [text, setText] = useState(currentValue || "");
  const trimmed = text.trim();
  const valid = trimmed.length > 0;
  const remaining = maxLength - text.length;

  const handleSubmit = () => {
    if (valid) onSubmit(trimmed);
  };

  return (
    <div className="bg-white border-4 border-indigo-300 rounded-2xl p-5 shadow-lg">
      <div className="text-sm font-bold text-indigo-600 mb-2">✏️ Your own idea for:</div>
      <div className="text-lg font-extrabold text-slate-800 mb-4">{stepLabel}</div>
      <input
        type="text"
        value={text}
        onChange={(e) => {
          if (e.target.value.length <= maxLength) setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valid) handleSubmit();
        }}
        placeholder="Type something fun..."
        autoFocus
        className="w-full text-lg p-4 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none mb-2"
      />
      <div className={`text-xs mb-4 ${remaining < 10 ? "text-orange-500" : "text-slate-400"}`}>
        {remaining} characters left
      </div>
      <div className="flex gap-2">
        <Button onClick={onCancel} variant="secondary" size="md" className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="primary" size="md" className="flex-1" disabled={!valid}>
          Use This
        </Button>
      </div>
    </div>
  );
}
