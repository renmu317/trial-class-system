// Phase 1 原版 + Phase 2 event callbacks
import { useState } from 'react';
import { Copy, Check, ChevronRight } from 'lucide-react';
import { LESSON, LEVEL_CONFIG } from '../lib/lesson';
import Button from './Button';

function MediumCard({ up, copiedId, onCopy }) {
  const initial = up.params.reduce((acc, p) => ({ ...acc, [p.key]: p.default }), {});
  const [values, setValues] = useState(initial);

  const clamp = (v, min, max) => {
    if (isNaN(v)) return min;
    return Math.max(min, Math.min(max, v));
  };

  const setVal = (key, raw, min, max) => {
    const n = parseInt(raw, 10);
    setValues({ ...values, [key]: isNaN(n) ? "" : clamp(n, min, max) });
  };

  const allFilled = up.params.every((p) => typeof values[p.key] === "number");
  const finalPrompt = allFilled ? up.buildPrompt(values) : "";

  return (
    <div className="bg-white border-2 border-blue-300 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-2xl">{up.emoji}</div>
        <div className="font-bold text-slate-800">{up.title}</div>
      </div>

      <div className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2.5 mb-3 leading-relaxed">
        🤔 <strong>Think first:</strong> {up.think}
      </div>

      <div className="space-y-2 mb-3">
        {up.params.map((p) => (
          <div key={p.key} className="flex items-center gap-2">
            <label className="text-xs text-slate-600 flex-1 leading-tight">{p.label}</label>
            <input
              type="number"
              value={values[p.key]}
              onChange={(e) => setVal(p.key, e.target.value, p.min, p.max)}
              onBlur={(e) => {
                if (e.target.value === "") setValues({ ...values, [p.key]: p.default });
              }}
              min={p.min}
              max={p.max}
              className="w-20 px-2 py-1.5 border-2 border-slate-200 rounded-lg text-center font-bold text-blue-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={() => allFilled && onCopy(finalPrompt, up.id, up.level)}
        variant={copiedId === up.id ? "success" : "primary"}
        size="sm"
        className="w-full"
        disabled={!allFilled}
      >
        {copiedId === up.id ? (<><Check className="w-4 h-4" /> Copied!</>) : (<><Copy className="w-4 h-4" /> Copy</>)}
      </Button>
    </div>
  );
}

function UpgradeCard({ up, copiedId, onCopy, onOwnIdeaSubmit }) {
  const [hardText, setHardText] = useState("");
  const [ownText, setOwnText] = useState("");

  if (up.isOwn) {
    const trimmed = ownText.trim();
    const valid = trimmed.length > 0;
    const remaining = LESSON.ownIdeaMaxLength - ownText.length;
    return (
      <div className="bg-white border-2 border-indigo-300 rounded-2xl p-4 sm:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-2xl">{up.emoji}</div>
          <div className="font-bold text-slate-800">{up.title}</div>
        </div>
        <input
          type="text"
          value={ownText}
          onChange={(e) => {
            if (e.target.value.length <= LESSON.ownIdeaMaxLength) setOwnText(e.target.value);
          }}
          placeholder="Type your upgrade idea..."
          className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none mb-2"
        />
        <div className={`text-xs mb-3 ${remaining < 10 ? "text-orange-500" : "text-slate-400"}`}>
          {remaining} characters left
        </div>
        <Button
          onClick={() => {
            if (valid) {
              onCopy(up.buildPrompt(trimmed), up.id, up.level);
              onOwnIdeaSubmit?.(trimmed);  // V17: trigger own idea event
            }
          }}
          variant={copiedId === up.id ? "success" : "primary"}
          size="sm"
          className="w-full"
          disabled={!valid}
        >
          {copiedId === up.id ? (<><Check className="w-4 h-4" /> Copied!</>) : (<><Copy className="w-4 h-4" /> Copy My Idea</>)}
        </Button>
      </div>
    );
  }

  if (up.level === "hard" && up.prompt === null) {
    const trimmed = hardText.trim();
    const valid = trimmed.length >= 10;
    const remaining = 200 - hardText.length;
    const wrapped = `Update my game with this idea: ${trimmed}. Make sure it works with the existing gameplay and the game stays fun and playable.`;
    return (
      <div className="bg-white border-2 border-purple-300 rounded-2xl p-4 sm:col-span-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-2xl">{up.emoji}</div>
          <div className="font-bold text-slate-800">{up.title}</div>
        </div>
        <div className="text-xs text-purple-700 bg-purple-50 rounded-lg p-2.5 mb-3 leading-relaxed">
          💭 <strong>Think first:</strong> {up.hint}
        </div>
        <textarea
          value={hardText}
          onChange={(e) => {
            if (e.target.value.length <= 200) setHardText(e.target.value);
          }}
          placeholder="Describe your idea here (10+ characters)..."
          rows={3}
          className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-purple-500 focus:outline-none mb-2 text-sm resize-none"
        />
        <div className={`text-xs mb-3 ${remaining < 30 ? "text-orange-500" : "text-slate-400"}`}>
          {remaining} characters left {!valid && hardText.length > 0 && "(need at least 10)"}
        </div>
        <Button
          onClick={() => valid && onCopy(wrapped, up.id, up.level)}
          variant={copiedId === up.id ? "success" : "primary"}
          size="sm"
          className="w-full"
          disabled={!valid}
        >
          {copiedId === up.id ? (<><Check className="w-4 h-4" /> Copied!</>) : (<><Copy className="w-4 h-4" /> Copy My Prompt</>)}
        </Button>
      </div>
    );
  }

  if (up.level === "medium") {
    return <MediumCard up={up} copiedId={copiedId} onCopy={onCopy} />;
  }

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-2xl">{up.emoji}</div>
        <div className="font-bold text-slate-800">{up.title}</div>
      </div>
      <div className="text-xs text-slate-500 mb-3 leading-relaxed">{up.prompt}</div>
      <Button
        onClick={() => onCopy(up.prompt, up.id, up.level)}
        variant={copiedId === up.id ? "success" : "primary"}
        size="sm"
        className="w-full"
      >
        {copiedId === up.id ? (<><Check className="w-4 h-4" /> Copied!</>) : (<><Copy className="w-4 h-4" /> Copy</>)}
      </Button>
    </div>
  );
}

export default function Upgrade({ onUpgradeCopy, onLevelOpen, onOwnIdeaSubmit }) {
  const [copiedId, setCopiedId] = useState(null);
  const [openLevels, setOpenLevels] = useState({ easy: true, medium: false, hard: false });

  const copyText = async (text, id, level) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedId(id);
    onUpgradeCopy?.(id, level);  // Phase 2: event callback
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleLevel = (lvl) => {
    console.log('toggleLevel called:', lvl, 'current state:', openLevels);
    const wasOpen = openLevels[lvl];

    // Use functional update to avoid stale closure
    setOpenLevels(prev => {
      const newState = { ...prev, [lvl]: !prev[lvl] };
      console.log('new state:', newState);
      return newState;
    });

    // Phase 2: event callback when opening medium or hard
    if (!wasOpen && (lvl === 'medium' || lvl === 'hard')) {
      onLevelOpen?.(lvl);
    }
  };

  const levels = ["easy", "medium", "hard"];
  const grouped = levels.reduce((acc, lvl) => {
    acc[lvl] = LESSON.upgrades.filter((u) => u.level === lvl);
    return acc;
  }, {});

  // Debug: log grouped items
  console.log('Upgrade grouped items:', grouped);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🚀</div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2">Upgrade Your Game</h2>
        <p className="text-slate-600 text-sm sm:text-base">Pick ONE. Copy and paste into the same chat.</p>
      </div>

      {levels.map((lvl) => {
        const cfg = LEVEL_CONFIG[lvl];
        const items = grouped[lvl];
        const isOpen = openLevels[lvl];
        if (!items || items.length === 0) return null;

        return (
          <div key={lvl} className="mb-4">
            <button
              type="button"
              onClick={() => toggleLevel(lvl)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${cfg.color}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{cfg.emoji}</div>
                <div className="text-left">
                  <div className={`font-extrabold text-base ${cfg.accent}`}>{cfg.label}</div>
                  <div className="text-xs text-slate-600">{cfg.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-xs font-bold ${cfg.accent}`}>{items.length}</div>
                <ChevronRight className={`w-5 h-5 ${cfg.accent} transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </div>
            </button>

            {isOpen && (
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                {items.map((up) => (
                  <UpgradeCard key={up.id} up={up} copiedId={copiedId} onCopy={copyText} onOwnIdeaSubmit={onOwnIdeaSubmit} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
