// Phase 1 原版 + Phase 2 event callbacks + V17 Agent Start button + Multi-lesson support
import { useState, useEffect } from 'react';
import { Copy, Check, ChevronRight, Play } from 'lucide-react';
import { LESSON, LEVEL_CONFIG } from '../lib/lesson';
import Button from './Button';

// Helper to get lesson from context or default
const getLessonAndConfig = (lessonConfig) => {
  const lesson = lessonConfig?.lesson || LESSON;
  const levelConfig = lessonConfig?.levelConfig || LEVEL_CONFIG;
  return { lesson, levelConfig };
};

// V17: Easy 卡（带 fillParam）- 直接显示数字输入，无需 Gate 1
// 支持两种 buildPrompt 格式：
// - Lesson 1: buildPrompt({ key: value }) 对象参数
// - Lesson 2: buildPrompt(value) 数字参数
function EasyFillCard({ up, copiedId, onCopy }) {
  const [value, setValue] = useState(up.fillParam.default);
  const { key, label, suffix, min, max, hint } = up.fillParam;

  const clamp = (v) => {
    if (isNaN(v)) return min;
    return Math.max(min, Math.min(max, v));
  };

  const handleChange = (e) => {
    const n = parseInt(e.target.value, 10);
    setValue(isNaN(n) ? "" : clamp(n));
  };

  const handleBlur = (e) => {
    if (e.target.value === "") setValue(up.fillParam.default);
  };

  // 支持两种 buildPrompt 格式
  const buildFinalPrompt = () => {
    if (typeof value !== "number") return "";
    // 判断 buildPrompt 接收的是对象还是数字
    // Lesson 1: buildPrompt({ key: value })
    // Lesson 2: buildPrompt(value)
    try {
      // 尝试对象参数格式（Lesson 1）
      const objResult = up.buildPrompt({ [key]: value });
      if (objResult && !objResult.includes("undefined") && !objResult.includes("[object Object]")) {
        return objResult;
      }
    } catch (e) {
      // 忽略错误
    }
    // 回退到数字参数格式（Lesson 2）
    return up.buildPrompt(value);
  };

  const finalPrompt = buildFinalPrompt();

  return (
    <div className="bg-white border-2 border-green-300 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-2xl">{up.emoji}</div>
        <div className="font-bold text-slate-800">{up.title}</div>
      </div>

      {/* 填空式输入：Label [数字] Suffix（suffix 可选） */}
      <div className="flex items-center flex-wrap gap-2 mb-2 text-sm text-slate-700">
        <span>{label}</span>
        <input
          type="number"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          min={min}
          max={max}
          className="w-16 px-2 py-1.5 border-2 border-green-200 rounded-lg text-center font-bold text-green-700 focus:border-green-500 focus:outline-none"
        />
        {suffix && <span>{suffix}</span>}
      </div>

      {/* hint 显示 */}
      {hint && (
        <p className="text-xs text-slate-400 mb-3">{hint}</p>
      )}

      <Button
        onClick={() => finalPrompt && onCopy(finalPrompt, up.id, up.level)}
        variant={copiedId === up.id ? "success" : "primary"}
        size="sm"
        className="w-full"
        disabled={!finalPrompt}
      >
        {copiedId === up.id ? (<><Check className="w-4 h-4" /> Copied!</>) : (<><Copy className="w-4 h-4" /> Copy</>)}
      </Button>
    </div>
  );
}

// Medium 卡：V17 Gate 1 追问意图，完成后显示参数输入 + hint + 推荐值
function MediumCard({ up, copiedId, onCopy, onStart, isCompleted, recommendations }) {
  // 使用推荐值作为初始值（如果有的话）
  const initial = up.params.reduce((acc, p) => {
    const rec = recommendations?.[p.key];
    return { ...acc, [p.key]: rec?.value ?? p.default };
  }, {});
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

      {/* V17: Gate 1 未完成时只显示 Start 按钮 */}
      {!isCompleted ? (
        <Button
          onClick={() => onStart(up.id, up.level)}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          <Play className="w-4 h-4" /> Start
        </Button>
      ) : (
        <>
          {/* V17: Gate 1 完成后显示参数输入区 + hint + 推荐值 */}
          <div className="space-y-3 mb-3">
            {up.params.map((p) => {
              const rec = recommendations?.[p.key];
              return (
                <div key={p.key}>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs text-slate-600 flex-1 leading-tight">{p.label}</label>
                    <input
                      type="number"
                      value={values[p.key]}
                      onChange={(e) => setVal(p.key, e.target.value, p.min, p.max)}
                      onBlur={(e) => {
                        if (e.target.value === "") setValues({ ...values, [p.key]: rec?.value ?? p.default });
                      }}
                      min={p.min}
                      max={p.max}
                      className="w-20 px-2 py-1.5 border-2 border-slate-200 rounded-lg text-center font-bold text-blue-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  {/* Agent 推荐值显示 */}
                  {rec && (
                    <p className="text-xs text-blue-500 ml-1 mb-1">
                      💡 Suggested: {rec.value} — {rec.reason}
                    </p>
                  )}
                  {/* hint 显示在输入框下方 */}
                  {p.hint && (
                    <p className="text-xs text-slate-400 ml-1">{p.hint}</p>
                  )}
                </div>
              );
            })}
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
        </>
      )}
    </div>
  );
}

function UpgradeCard({ up, copiedId, onCopy, onOwnIdeaSubmit, onStart, isCompleted, lesson, recommendations, bestQuote, draftPrompt, dynamicConfig }) {
  const [hardText, setHardText] = useState("");
  const [ownText, setOwnText] = useState("");
  const [dynamicParamValues, setDynamicParamValues] = useState({});

  // Hard Upgrade：当 Gate 1 完成且有 draftPrompt 时，预填 textarea
  useEffect(() => {
    if (isCompleted && draftPrompt && !hardText) {
      setHardText(draftPrompt);
    }
  }, [isCompleted, draftPrompt]);

  const ownIdeaMaxLength = lesson?.ownIdeaMaxLength || 60;

  // Medium Own Idea - 动态 params 模式
  if (up.id === '__own_medium__' && up.dynamicParams) {
    // Gate 1 未完成：显示 Start 按钮
    if (!isCompleted) {
      return (
        <div className="bg-white border-2 border-blue-300 rounded-2xl p-4 sm:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-2xl">{up.emoji}</div>
            <div className="font-bold text-slate-800">{up.title}</div>
          </div>
          <div className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2.5 mb-3 leading-relaxed">
            🤔 <strong>Think first:</strong> {up.think}
          </div>
          <Button
            onClick={() => onStart(up.id, up.level)}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            <Play className="w-4 h-4" /> Start
          </Button>
        </div>
      );
    }

    // Gate 1 完成但没有动态配置：显示加载中
    if (!dynamicConfig?.params || !dynamicConfig?.template) {
      return (
        <div className="bg-white border-2 border-blue-300 rounded-2xl p-4 sm:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-2xl">{up.emoji}</div>
            <div className="font-bold text-slate-800">{up.title}</div>
          </div>
          <p className="text-slate-400 text-sm">Loading your custom feature...</p>
        </div>
      );
    }

    // Gate 1 完成：显示动态生成的 params 输入框
    const { params, template } = dynamicConfig;

    // 初始化动态参数值
    const getParamValue = (key, param) => {
      if (dynamicParamValues[key] !== undefined) return dynamicParamValues[key];
      return Math.round((param.min + param.max) / 2);  // 默认中间值
    };

    const allFilled = params.every(p => {
      const val = getParamValue(p.key, p);
      return typeof val === 'number' && !isNaN(val);
    });

    const buildFinalPrompt = () => {
      const values = {};
      params.forEach(p => {
        values[p.key] = getParamValue(p.key, p);
      });
      return up.buildPrompt(values, template);
    };

    const finalPrompt = allFilled ? buildFinalPrompt() : '';

    return (
      <div className="bg-white border-2 border-blue-300 rounded-2xl p-4 sm:col-span-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-2xl">{up.emoji}</div>
          <div className="font-bold text-slate-800">{up.title}</div>
        </div>

        <div className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2.5 mb-3 leading-relaxed">
          ✨ Your custom feature is ready! Fill in the numbers below.
        </div>

        {/* 动态生成的 params 输入区 */}
        <div className="space-y-3 mb-3">
          {params.map((p) => (
            <div key={p.key}>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs text-slate-600 flex-1 leading-tight">{p.label}</label>
                <input
                  type="number"
                  value={getParamValue(p.key, p)}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    const clamped = Math.max(p.min, Math.min(p.max, isNaN(n) ? p.min : n));
                    setDynamicParamValues(prev => ({ ...prev, [p.key]: clamped }));
                  }}
                  min={p.min}
                  max={p.max}
                  className="w-20 px-2 py-1.5 border-2 border-slate-200 rounded-lg text-center font-bold text-blue-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              {p.hint && (
                <p className="text-xs text-slate-400 ml-1">{p.hint}</p>
              )}
              {p.intent && (
                <p className="text-xs text-purple-500 ml-1 mt-1">
                  💬 Based on: "{p.intent}"
                </p>
              )}
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

  // Hard Own Idea - 使用现有 Hard 逻辑（带 Gate 1）
  if (up.id === '__own_hard__') {
    // 复用标准 Hard 卡片逻辑（在下面的 if 语句中处理）
    // 继续执行到 hard 卡片逻辑
  }

  // V17: "My Own Idea" (Easy) 不需要 Gate 1，直接显示输入框
  if (up.isOwn && up.level === 'easy') {
    const trimmed = ownText.trim();
    const valid = trimmed.length > 0;
    const remaining = ownIdeaMaxLength - ownText.length;
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
            if (e.target.value.length <= ownIdeaMaxLength) setOwnText(e.target.value);
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

  // V17: Hard Upgrade - 需要 Gate 1，完成后显示三区域界面
  if (up.level === "hard" && up.prompt === null) {
    const trimmed = hardText.trim();
    const valid = trimmed.length >= 10;
    const wrapped = `Update my game with this idea: ${trimmed}. Make sure it works with the existing gameplay and the game stays fun and playable.`;

    // 动态 placeholder：有 bestQuote 时更具方向感
    const placeholder = bestQuote
      ? "Start from your idea above. Describe it fully so Claude can build it exactly the way you imagined..."
      : "Describe your idea in detail. What does it do? When does it trigger? What happens?";

    return (
      <div className="bg-white border-2 border-purple-300 rounded-2xl p-4 sm:col-span-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-2xl">{up.emoji}</div>
          <div className="font-bold text-slate-800">{up.title}</div>
        </div>

        {/* V17: Gate 1 未完成时显示 hint + Start 按钮 */}
        {!isCompleted ? (
          <>
            <div className="text-xs text-purple-700 bg-purple-50 rounded-lg p-2.5 mb-3 leading-relaxed">
              💭 <strong>Think first:</strong> {up.hint}
            </div>
            <Button
              onClick={() => onStart(up.id, up.level)}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              <Play className="w-4 h-4" /> Start
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            {/* 区域1：bestQuote 展示（降低视觉重量，作为参考） */}
            {bestQuote && (
              <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                <p className="text-xs text-purple-400 mb-1">💬 Key idea from conversation:</p>
                <p className="text-xs text-purple-700 italic">"{bestQuote}"</p>
              </div>
            )}

            {/* 区域2：textarea 预填 draftPrompt */}
            <textarea
              value={hardText}
              onChange={(e) => setHardText(e.target.value)}
              placeholder="Your description will appear here after the conversation..."
              rows={5}
              className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-purple-500 focus:outline-none text-sm resize-none"
            />

            {/* 提示：可以修改（仅当内容与 draftPrompt 相同时显示） */}
            {hardText && hardText === draftPrompt && (
              <p className="text-xs text-slate-400">
                ✏️ Based on your conversation — feel free to edit
              </p>
            )}

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
        )}
      </div>
    );
  }

  // V17: Medium Upgrade - 需要 Gate 1（追问意图）
  if (up.level === "medium") {
    return <MediumCard up={up} copiedId={copiedId} onCopy={onCopy} onStart={onStart} isCompleted={isCompleted} recommendations={recommendations} />;
  }

  // V17 Lesson 2: Easy Upgrade 带 fillParam - 直接显示数字输入，无需 Gate 1
  if (up.level === "easy" && up.fillParam) {
    return <EasyFillCard up={up} copiedId={copiedId} onCopy={onCopy} />;
  }

  // V17: Easy Upgrade（非 "My Own Idea"，无 fillParam）- Lesson 1 风格，需要 Gate 1
  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-2xl">{up.emoji}</div>
        <div className="font-bold text-slate-800">{up.title}</div>
      </div>
      <div className="text-xs text-slate-500 mb-3 leading-relaxed">{up.prompt}</div>

      {/* V17: Gate 1 未完成时显示 Start，完成后显示 Copy */}
      {!isCompleted ? (
        <Button
          onClick={() => onStart(up.id, up.level)}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          <Play className="w-4 h-4" /> Start
        </Button>
      ) : (
        <Button
          onClick={() => onCopy(up.prompt, up.id, up.level)}
          variant={copiedId === up.id ? "success" : "primary"}
          size="sm"
          className="w-full"
        >
          {copiedId === up.id ? (<><Check className="w-4 h-4" /> Copied!</>) : (<><Copy className="w-4 h-4" /> Copy</>)}
        </Button>
      )}
    </div>
  );
}

export default function Upgrade({ onUpgradeCopy, onLevelOpen, onOwnIdeaSubmit, onStartUpgrade, completedUpgrades = [], upgradeRecommendations = {}, upgradeQuotes = {}, upgradeDrafts = {}, dynamicUpgradeConfig = {}, lessonConfig }) {
  const [copiedId, setCopiedId] = useState(null);
  const [openLevels, setOpenLevels] = useState({ easy: true, medium: false, hard: false });

  // Use lessonConfig if provided, otherwise fallback to defaults
  const { lesson, levelConfig } = getLessonAndConfig(lessonConfig);

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
    acc[lvl] = lesson.upgrades.filter((u) => u.level === lvl);
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
        const cfg = levelConfig[lvl];
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
                  <UpgradeCard
                    key={up.id}
                    up={up}
                    copiedId={copiedId}
                    onCopy={copyText}
                    onOwnIdeaSubmit={onOwnIdeaSubmit}
                    onStart={onStartUpgrade}
                    isCompleted={completedUpgrades.includes(up.id)}
                    lesson={lesson}
                    recommendations={upgradeRecommendations[up.id]}
                    bestQuote={upgradeQuotes[up.id]}
                    draftPrompt={upgradeDrafts[up.id]}
                    dynamicConfig={dynamicUpgradeConfig[up.id]}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
