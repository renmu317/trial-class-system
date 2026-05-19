// Phase 1 原版 + Phase 2 event callback
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { RECOVERY } from '../lib/lesson';

export default function Recovery({ onHelpOpen }) {
  const [openId, setOpenId] = useState(null);

  const handleClick = (itemId) => {
    const newId = openId === itemId ? null : itemId;
    setOpenId(newId);
    if (newId) {
      onHelpOpen?.(itemId);  // Phase 2: event callback when opening
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🛟</div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2">Help</h2>
        <p className="text-slate-600 text-sm sm:text-base">Tap your problem to see how to fix it</p>
      </div>

      <div className="space-y-3">
        {RECOVERY.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            className="w-full text-left bg-white border-2 border-slate-200 rounded-2xl p-4 hover:border-indigo-300 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">{item.icon}</div>
              <div className="flex-1 font-bold text-slate-800 text-sm sm:text-base">{item.title}</div>
              <ChevronRight
                className={`w-5 h-5 text-slate-400 transition-transform ${openId === item.id ? "rotate-90" : ""}`}
              />
            </div>
            {openId === item.id && (
              <div className="mt-3 pt-3 border-t-2 border-slate-100 text-slate-700 text-sm sm:text-base leading-relaxed">
                {item.fix}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
