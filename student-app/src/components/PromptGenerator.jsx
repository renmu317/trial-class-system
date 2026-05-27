// Phase 1 原版 PromptGenerator + Multi-lesson support
// V18: 分层显示 — 学生设计高亮 + 规则简洁展示
import { useState } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { LESSON } from '../lib/lesson';
import { useLanguage } from '../lib/LanguageContext';
import Button from './Button';

// 翻译文本
const PROMPT_TEXT = {
  en: {
    ready: 'Your prompt is ready!',
    copyThen: 'Copy it, then paste into claude.ai',
    yourDesign: 'Your Design',
    gameRules: 'Game Rules',
    showFull: 'Show full prompt',
    hideFull: 'Hide full prompt',
    copyPrompt: 'Copy Prompt',
    copied: 'Copied! Now paste into claude.ai',
    nextSteps: 'Next steps:',
    step1: 'Click Copy above',
    step2: 'Go to',
    step3: 'Paste into the chat box and press Enter',
    step4: 'Watch the right side of the screen!',
    startOver: 'Start Over',
    copyFailed: "Couldn't copy automatically. Please select the text and press Ctrl+C / Cmd+C.",
  },
  zh: {
    ready: '你的提示词准备好了！',
    copyThen: '复制后粘贴到 claude.ai',
    yourDesign: '你的设计',
    gameRules: '游戏规则',
    showFull: '显示完整提示词',
    hideFull: '隐藏完整提示词',
    copyPrompt: '复制提示词',
    copied: '已复制！现在粘贴到 claude.ai',
    nextSteps: '下一步：',
    step1: '点击上方复制',
    step2: '打开',
    step3: '粘贴到聊天框并按回车',
    step4: '看屏幕右侧！',
    startOver: '重新开始',
    copyFailed: '无法自动复制。请选中文本后按 Ctrl+C / Cmd+C。',
  }
};

function getPromptText(language) {
  return PROMPT_TEXT[language] || PROMPT_TEXT.en;
}

export default function PromptGenerator({ choices, ownInputs, gameName, onReset, onPromptGenerated, lessonConfig, rules }) {
  const { language } = useLanguage();
  const t = getPromptText(language);
  const [copied, setCopied] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  // Use lessonConfig if provided, otherwise fallback to default LESSON
  const lesson = lessonConfig?.lesson || LESSON;

  // For Lesson 2, pass rules to buildPrompt
  const prompt = lesson.ruleDesign?.enabled
    ? lesson.buildPrompt(choices, ownInputs, gameName, rules || {})
    : lesson.buildPrompt(choices, ownInputs, gameName);

  // 提取学生的设计选择（用于高亮显示）
  const getDesignSummary = () => {
    if (!lesson.steps) return [];
    return lesson.steps.map(step => {
      const val = choices[step.id];
      if (!val) return null;
      const matchedOpt = step.options?.find(o => o.value === val);
      const label = val === '__own__'
        ? (ownInputs[step.id] || '')
        : matchedOpt?.label || val;
      const emoji = matchedOpt?.emoji || '✏️';
      return { question: step.label, answer: label, emoji };
    }).filter(Boolean);
  };

  // 提取游戏规则（用于简洁展示）
  const getGameRules = () => {
    if (!lesson.ruleDesign?.enabled || !rules) return [];
    return lesson.ruleDesign.fields.map(field => {
      const val = rules[field.id];
      if (!val) return null;
      const matchedOpt = field.options?.find(o => o.value === val);
      const label = matchedOpt?.label || val;
      return { emoji: field.emoji, label: field.label, value: label };
    }).filter(Boolean);
  };

  const designSummary = getDesignSummary();
  const gameRules = getGameRules();

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
        onPromptGenerated?.();
        setTimeout(() => setCopied(false), 2500);
      } catch {
        alert(t.copyFailed);
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-5">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-2xl font-extrabold text-slate-800 mb-1">{t.ready}</h2>
        <p className="text-slate-500 text-sm">{t.copyThen}</p>
      </div>

      {/* 层1：学生的设计选择（橙色高亮） */}
      <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-3">
        <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-3">
          🎨 {t.yourDesign}
        </p>
        <div className="space-y-2">
          {designSummary.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-slate-400 text-xs w-28 flex-shrink-0">{item.question}</span>
              <span className="bg-orange-100 text-orange-800 font-semibold text-sm px-2 py-0.5 rounded-lg">
                {item.emoji} {item.answer}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 层2：游戏规则（简洁展示） - 仅Lesson 2 */}
      {gameRules.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
            📋 {t.gameRules}
          </p>
          <div className="space-y-1.5">
            {gameRules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span>{rule.emoji}</span>
                <span className="text-slate-500">{rule.label}:</span>
                <span className="text-slate-700 font-medium">{rule.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 完整 prompt 折叠（想看可以展开） */}
      <button
        onClick={() => setShowFullPrompt(!showFullPrompt)}
        className="w-full text-xs text-slate-400 hover:text-slate-600 mb-3 text-left flex items-center gap-1"
      >
        {showFullPrompt ? `▲ ${t.hideFull}` : `▼ ${t.showFull}`}
      </button>

      {showFullPrompt && (
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 mb-3 max-h-60 overflow-y-auto">
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{prompt}</pre>
        </div>
      )}

      {/* Copy按钮 */}
      <Button onClick={copyPrompt} variant={copied ? "success" : "primary"} className="w-full mb-3" size="lg">
        {copied ? (
          <><Check className="w-6 h-6" /> {t.copied}</>
        ) : (
          <><Copy className="w-6 h-6" /> {t.copyPrompt}</>
        )}
      </Button>

      {/* Next steps */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-900">
        <div className="font-bold mb-2">📋 {t.nextSteps}</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>{t.step1}</li>
          <li>{t.step2} <strong>claude.ai</strong></li>
          <li>{t.step3}</li>
          <li>{t.step4}</li>
        </ol>
      </div>

      <Button onClick={onReset} variant="secondary" size="md" className="w-full">
        <RotateCcw className="w-4 h-4" /> {t.startOver}
      </Button>
    </div>
  );
}
