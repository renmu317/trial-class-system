// Phase 1 原版 PromptGenerator - 不要修改
import { useState } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { LESSON } from '../lib/lesson';
import Button from './Button';

export default function PromptGenerator({ choices, ownInputs, gameName, onReset, onPromptGenerated }) {
  const [copied, setCopied] = useState(false);
  const prompt = LESSON.buildPrompt(choices, ownInputs, gameName);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      onPromptGenerated?.();  // V17: trigger prompt_generated event
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = prompt;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        alert("Couldn't copy automatically. Please select the text and press Ctrl+C / Cmd+C.");
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2">Your prompt is ready!</h2>
        <p className="text-slate-600 text-sm sm:text-base">Copy it, then paste into claude.ai</p>
      </div>

      <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 sm:p-5 mb-4 max-h-72 overflow-y-auto">
        <pre className="text-xs sm:text-sm whitespace-pre-wrap font-mono leading-relaxed">{prompt}</pre>
      </div>

      <Button onClick={copyPrompt} variant={copied ? "success" : "primary"} className="w-full mb-3" size="lg">
        {copied ? (
          <>
            <Check className="w-6 h-6" /> Copied! Now paste into claude.ai
          </>
        ) : (
          <>
            <Copy className="w-6 h-6" /> Copy Prompt
          </>
        )}
      </Button>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-900">
        <div className="font-bold mb-2">📋 Next steps:</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click the Copy button above</li>
          <li>Go to <strong>claude.ai</strong></li>
          <li>Paste into the chat box at the bottom</li>
          <li>Press Enter — watch the right side of the screen!</li>
        </ol>
      </div>

      <Button onClick={onReset} variant="secondary" size="md" className="w-full">
        <RotateCcw className="w-4 h-4" /> Start Over
      </Button>
    </div>
  );
}
