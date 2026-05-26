// Lesson 2 exclusive: Debug Log Tab
// When maze breaks, student taps what broke and gets a targeted fix prompt

import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import Button from './Button';

function BreakTypeCard({ breakType, onSelect, isSelected }) {
  return (
    <button
      onClick={() => onSelect(breakType)}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
        isSelected
          ? 'bg-pink-100 border-pink-500 shadow-lg scale-[1.02]'
          : 'bg-white border-pink-200 hover:border-pink-400 hover:bg-pink-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{breakType.emoji}</span>
        <div className="flex-1">
          <div className="font-bold text-slate-800">{breakType.label}</div>
          <div className="text-xs text-slate-500">{breakType.description}</div>
        </div>
        {isSelected && <Check className="w-5 h-5 text-pink-600" />}
      </div>
    </button>
  );
}

function DebugEntry({ entry, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-pink-200 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between bg-pink-50 hover:bg-pink-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-pink-600">#{index + 1}</span>
          <span className="text-slate-700">{entry.breakType}</span>
          {entry.fixed && <span className="text-green-600">✓ Fixed</span>}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-pink-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-pink-400" />
        )}
      </button>
      {expanded && (
        <div className="px-3 py-2 text-xs text-slate-600 border-t border-pink-100">
          <p><strong>What I told Claude:</strong> {entry.prompt}</p>
          {entry.notes && <p className="mt-1"><strong>Notes:</strong> {entry.notes}</p>}
        </div>
      )}
    </div>
  );
}

export default function DebugLog({ lessonConfig, debugEntries, setDebugEntries, onPromptCopy }) {
  const [selectedBreak, setSelectedBreak] = useState(null);
  const [customProblem, setCustomProblem] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(null);

  const debugLog = lessonConfig?.lesson?.debugLog;

  if (!debugLog?.enabled) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-4xl mb-3">🐛</div>
        <p className="text-slate-600">Debug Log is not available for this lesson.</p>
      </div>
    );
  }

  const handleSelectBreak = (breakType) => {
    setSelectedBreak(breakType);
    setCustomProblem('');
  };

  const generateFixPrompt = () => {
    if (!selectedBreak) return '';

    if (selectedBreak.id === 'other') {
      return customProblem.trim()
        ? `Please fix this problem with my maze: ${customProblem.trim()}`
        : '';
    }

    return selectedBreak.fixPrompt;
  };

  const handleCopyPrompt = async () => {
    const prompt = generateFixPrompt();
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);

      // Add to debug log history
      const newEntry = {
        breakType: selectedBreak.label,
        prompt: prompt,
        timestamp: new Date().toISOString(),
        fixed: false,
      };
      setDebugEntries([...debugEntries, newEntry]);

      // Callback for event tracking
      onPromptCopy?.(selectedBreak.id, prompt);

      // Reset selection after short delay
      setTimeout(() => {
        setSelectedBreak(null);
        setCustomProblem('');
        setCopiedPrompt(null);
      }, 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const fixPrompt = generateFixPrompt();
  const canCopy = fixPrompt.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-500 rounded-t-2xl px-5 py-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🐛</span>
          <h2 className="text-lg font-bold">Debug Log</h2>
        </div>
        <p className="text-pink-100 text-sm">
          Maze broken? Tap what broke, copy the fix, paste in Claude
        </p>
      </div>

      {/* Main content */}
      <div className="border-2 border-t-0 border-pink-200 rounded-b-2xl p-4 bg-gradient-to-b from-pink-50 to-white">
        {/* Break type selection */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">What broke?</h3>
          <div className="grid gap-2">
            {debugLog.breakTypes.map((breakType) => (
              <BreakTypeCard
                key={breakType.id}
                breakType={breakType}
                onSelect={handleSelectBreak}
                isSelected={selectedBreak?.id === breakType.id}
              />
            ))}
          </div>
        </div>

        {/* Custom problem input (for "other") */}
        {selectedBreak?.id === 'other' && (
          <div className="mb-4 p-4 bg-white border-2 border-pink-300 rounded-xl">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Describe the problem:
            </label>
            <textarea
              value={customProblem}
              onChange={(e) => setCustomProblem(e.target.value)}
              placeholder="e.g. 'The player can walk through walls on the left side'"
              className="w-full px-3 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none text-sm resize-none"
              rows={2}
              maxLength={200}
            />
          </div>
        )}

        {/* Generated fix prompt */}
        {selectedBreak && fixPrompt && (
          <div className="mb-4 p-4 bg-white border-2 border-pink-300 rounded-xl">
            <div className="text-xs font-bold text-pink-600 uppercase mb-2">
              Fix Prompt (Copy and paste into Claude):
            </div>
            <div className="bg-pink-50 rounded-lg p-3 text-sm text-slate-700 font-mono">
              {fixPrompt}
            </div>
            <Button
              variant={copiedPrompt ? 'success' : 'primary'}
              size="md"
              onClick={handleCopyPrompt}
              disabled={!canCopy}
              className="mt-3 w-full"
            >
              {copiedPrompt ? (
                <>
                  <Check className="w-4 h-4" /> Copied! Paste in Claude
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy Fix Prompt
                </>
              )}
            </Button>
          </div>
        )}

        {/* Debug history */}
        {debugEntries.length > 0 && (
          <div className="mt-6 pt-4 border-t border-pink-200">
            <h3 className="text-sm font-bold text-slate-700 mb-2">
              Debug History ({debugEntries.length} fixes attempted)
            </h3>
            {debugEntries.map((entry, i) => (
              <DebugEntry key={i} entry={entry} index={i} />
            ))}
          </div>
        )}

        {/* Tip */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <strong>Tip:</strong> Fix one thing at a time. If the first fix doesn't work,
          come back and try a different option.
        </div>
      </div>
    </div>
  );
}
