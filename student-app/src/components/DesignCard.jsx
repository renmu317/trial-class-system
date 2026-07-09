// Phase 1 原版 + Phase 2 event callback + Multi-lesson support
// V18: 点选改填空 — 输入框 + 快速标签
import { useState, useEffect } from 'react';
import { LESSON } from '../lib/lesson';
import { useT } from '../i18n';
import Button from './Button';

export default function DesignCard({ choices, setChoices, ownInputs, setOwnInputs, onDone, onOwnIdeaSubmit, lessonConfig }) {
  const t = useT();
  const [stepIdx, setStepIdx] = useState(0);
  const [inputValue, setInputValue] = useState('');

  // Use lessonConfig if provided, otherwise fallback to default LESSON
  const lesson = lessonConfig?.lesson || LESSON;
  const step = lesson.steps[stepIdx];
  const isLast = stepIdx === lesson.steps.length - 1;

  // 当前step的默认值（第一个非Own选项的label）
  const defaultOption = step.options?.find(o => !o.isOwn);
  const placeholder = defaultOption?.label || '';

  // 当step变化时，恢复之前的选择（如果有）
  useEffect(() => {
    const existing = choices[step.id];
    if (existing && existing !== '__own__') {
      const opt = step.options?.find(o => o.value === existing);
      setInputValue(opt?.label || '');
    } else if (existing === '__own__' && ownInputs[step.id]) {
      setInputValue(ownInputs[step.id]);
    } else {
      setInputValue('');
    }
  }, [stepIdx, step.id]);

  const advance = () => {
    setTimeout(() => {
      if (isLast) onDone();
      else {
        setStepIdx(stepIdx + 1);
      }
    }, 150);
  };

  const submitStep = () => {
    const val = inputValue.trim() || placeholder;

    // 检查是否匹配预设选项（不区分大小写）
    const matchedOption = step.options?.find(
      o => !o.isOwn && o.label.toLowerCase() === val.toLowerCase()
    );

    if (matchedOption) {
      // 匹配预设选项：用option的value
      setChoices({ ...choices, [step.id]: matchedOption.value });
    } else {
      // 自定义输入：当作Own Idea处理
      setOwnInputs({ ...ownInputs, [step.id]: val });
      setChoices({ ...choices, [step.id]: '__own__' });
      onOwnIdeaSubmit?.(step.id, val);
    }

    advance();
  };

  const quickSelect = (opt) => {
    setInputValue(opt.label);
    setChoices({ ...choices, [step.id]: opt.value });
    advance();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* 进度条 */}
      <div className="flex gap-2 mb-6">
        {lesson.steps.map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all ${
              i < stepIdx ? "bg-orange-500" : i === stepIdx ? "bg-orange-400" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <div className="mb-2 text-sm font-semibold text-orange-500">
        {t('design.stepOf', { current: stepIdx + 1, total: lesson.steps.length })}
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-3">
        {step.label}
      </h2>

      {/* 输入框 */}
      <div className="mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitStep()}
          placeholder={placeholder}
          className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-lg font-medium focus:border-orange-400 outline-none transition-colors"
          autoFocus
        />
        {/* 提示：可以直接按Enter用默认值 */}
        <p className="text-xs text-slate-400 mt-2 ml-1">
          {t('design.enterHint', { placeholder })}
        </p>
      </div>

      {/* 快速选项（预设选项作为标签，点击填入）*/}
      <div className="flex flex-wrap gap-2 mb-6">
        {step.options?.filter(o => !o.isOwn).map((opt) => (
          <button
            key={opt.value}
            onClick={() => quickSelect(opt)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
              choices[step.id] === opt.value
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
            }`}
          >
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>

      {/* 导航按钮 */}
      <div className="flex gap-3">
        {stepIdx > 0 && (
          <Button variant="ghost" size="md" onClick={() => setStepIdx(stepIdx - 1)}>
            ← {t('common.back')}
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={submitStep}
          className="flex-1"
        >
          {isLast ? t('design.buildMyGame') + ' →' : t('common.next') + ' →'}
        </Button>
      </div>
    </div>
  );
}
