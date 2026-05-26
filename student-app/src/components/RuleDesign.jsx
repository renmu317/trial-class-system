// Lesson 2 exclusive: Rule Design Tab
// Students fill in game rules before generating prompt

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import Button from './Button';

function RuleField({ field, value, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setShowCustom(false);
  };

  const handleCustom = () => {
    setShowCustom(true);
  };

  const submitCustom = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setShowCustom(false);
    }
  };

  const isSelected = (optionValue) => value === optionValue;
  const hasValue = value && value.length > 0;

  return (
    <div className="bg-white border-2 border-purple-200 rounded-xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{field.emoji}</span>
        <div>
          <div className="font-bold text-slate-800">{field.label}</div>
          <div className="text-xs text-purple-600">{field.question}</div>
        </div>
        {hasValue && (
          <div className="ml-auto">
            <Check className="w-5 h-5 text-green-500" />
          </div>
        )}
      </div>

      {showCustom ? (
        <div className="space-y-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder={field.placeholder}
            maxLength={100}
            className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={submitCustom}
              disabled={!customValue.trim()}
            >
              Use this
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCustom(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.label)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                isSelected(opt.label)
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {field.allowCustom && (
            <button
              onClick={handleCustom}
              className="px-3 py-1.5 rounded-full text-sm font-medium border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 transition-all"
            >
              ✏️ My idea
            </button>
          )}
        </div>
      )}

      {/* Show current value if custom */}
      {hasValue && !field.options.some(o => o.label === value) && (
        <div className="mt-2 px-3 py-1.5 bg-purple-50 rounded-lg text-sm text-purple-700 inline-block">
          "{value}"
        </div>
      )}
    </div>
  );
}

export default function RuleDesign({ lessonConfig, rules, setRules, onDone }) {
  const ruleDesign = lessonConfig?.lesson?.ruleDesign;

  if (!ruleDesign?.enabled) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-4xl mb-3">📐</div>
        <p className="text-slate-600">Rule Design is not available for this lesson.</p>
      </div>
    );
  }

  const handleChange = (fieldId, value) => {
    setRules({ ...rules, [fieldId]: value });
  };

  // Check if all required fields are filled
  const allFilled = ruleDesign.fields.every(f => rules[f.id]?.trim().length > 0);

  // Count filled fields
  const filledCount = ruleDesign.fields.filter(f => rules[f.id]?.trim().length > 0).length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl px-5 py-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📐</span>
          <h2 className="text-lg font-bold">Rule Design</h2>
        </div>
        <p className="text-purple-100 text-sm">
          Fill in how your game works before writing the prompt
        </p>
      </div>

      {/* Progress */}
      <div className="bg-purple-50 px-5 py-3 border-x-2 border-purple-200 flex items-center justify-between">
        <span className="text-sm text-purple-700">
          {filledCount} of {ruleDesign.fields.length} rules filled
        </span>
        <div className="flex gap-1">
          {ruleDesign.fields.map((f, i) => (
            <div
              key={f.id}
              className={`w-3 h-3 rounded-full ${
                rules[f.id]?.trim() ? 'bg-purple-600' : 'bg-purple-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Rule fields */}
      <div className="border-2 border-t-0 border-purple-200 rounded-b-2xl p-4 bg-gradient-to-b from-purple-50 to-white">
        {ruleDesign.fields.map((field) => (
          <RuleField
            key={field.id}
            field={field}
            value={rules[field.id] || ''}
            onChange={(value) => handleChange(field.id, value)}
          />
        ))}

        {/* Done button */}
        <div className="mt-4 text-center">
          <Button
            variant={allFilled ? 'primary' : 'secondary'}
            size="lg"
            onClick={onDone}
            className="w-full sm:w-auto"
          >
            {allFilled ? '✓ Rules Ready - Go to Prompt' : 'Continue with defaults'}
          </Button>
          {!allFilled && (
            <p className="text-xs text-slate-500 mt-2">
              You can skip unfilled rules - defaults will be used
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
