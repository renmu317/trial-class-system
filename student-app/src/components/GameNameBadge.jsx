// Phase 1 原版 + Phase 2 event callback
import { useState, useEffect } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { LESSON } from '../lib/lesson';

export default function GameNameBadge({ gameName, displayName, isCustom, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(gameName);

  useEffect(() => {
    setText(gameName);
  }, [gameName]);

  const save = () => {
    const newName = text.trim().slice(0, LESSON.gameNameMaxLength);
    onSave(newName, gameName);  // Phase 2: 传递 oldName 用于 event
    setEditing(false);
  };

  const cancel = () => {
    setText(gameName);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            if (e.target.value.length <= LESSON.gameNameMaxLength) setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          placeholder="Name your game..."
          autoFocus
          className="flex-1 text-sm font-bold px-3 py-1.5 border-2 border-indigo-400 rounded-lg focus:outline-none"
        />
        <button onClick={save} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg" aria-label="Save">
          <Check className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all max-w-[60vw] sm:max-w-md ${
        isCustom ? "bg-indigo-50 hover:bg-indigo-100" : "bg-slate-100 hover:bg-slate-200"
      }`}
      title="Tap to rename"
    >
      <span className={`text-sm font-bold truncate ${isCustom ? "text-indigo-700" : "text-slate-600"}`}>
        {displayName}
      </span>
      <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${isCustom ? "text-indigo-500" : "text-slate-400"}`} />
    </button>
  );
}
