// Phase 1 原版 + Phase 2 event callback
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LESSON } from '../lib/lesson';
import OptionCard from './OptionCard';
import OwnIdeaInput from './OwnIdeaInput';
import Button from './Button';

export default function DesignCard({ choices, setChoices, ownInputs, setOwnInputs, onDone, onOwnIdeaSubmit }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [showOwnInput, setShowOwnInput] = useState(false);
  const step = LESSON.steps[stepIdx];
  const isLast = stepIdx === LESSON.steps.length - 1;
  const selected = choices[step.id];

  const advance = () => {
    setShowOwnInput(false);
    setTimeout(() => {
      if (isLast) onDone();
      else setStepIdx(stepIdx + 1);
    }, 250);
  };

  const pick = (option) => {
    if (option.isOwn) {
      setShowOwnInput(true);
      return;
    }
    const next = { ...choices, [step.id]: option.value };
    setChoices(next);
    setTimeout(advance, 0);
  };

  const submitOwnIdea = (text) => {
    setOwnInputs({ ...ownInputs, [step.id]: text });
    setChoices({ ...choices, [step.id]: "__own__" });
    onOwnIdeaSubmit?.(step.id, text);  // Phase 2: event callback
    advance();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex gap-2 mb-6">
        {LESSON.steps.map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all ${
              i < stepIdx ? "bg-indigo-600" : i === stepIdx ? "bg-indigo-400" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <div className="mb-2 text-sm font-semibold text-indigo-600">
        Step {stepIdx + 1} of {LESSON.steps.length}
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-6">{step.label}</h2>

      {showOwnInput ? (
        <OwnIdeaInput
          stepLabel={step.label}
          currentValue={ownInputs[step.id]}
          maxLength={LESSON.ownIdeaMaxLength}
          onSubmit={submitOwnIdea}
          onCancel={() => setShowOwnInput(false)}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            {step.options.map((opt) => (
              <OptionCard
                key={opt.value}
                option={opt}
                selected={selected === opt.value}
                onClick={() => pick(opt)}
              />
            ))}
          </div>

          {stepIdx > 0 && (
            <Button variant="ghost" size="md" onClick={() => setStepIdx(stepIdx - 1)}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          )}
        </>
      )}
    </div>
  );
}
