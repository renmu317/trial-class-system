// Phase 1 原版 + Phase 2 session/event 管理 + V17 Agent + Multi-lesson support + i18n
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { reportEvent, startEventFlush } from './lib/events';
import { LESSON, TABS } from './lib/lesson';
import { agentBridge } from './lib/AgentBridge';
import { LESSONS, getLessonConfig, hasRuleDesign, hasDebugLog } from './lib/lessonConfig';
import { LanguageProvider, useLanguage, LanguageToggle } from './lib/LanguageContext';
import { useT } from './i18n';

import NameInput from './components/NameInput';
import CodeInput from './components/CodeInput';
import GameNameBadge from './components/GameNameBadge';
import DesignCard from './components/DesignCard';
import PromptGenerator from './components/PromptGenerator';
import Recovery from './components/Recovery';
import Upgrade from './components/Upgrade';
import Button from './components/Button';
import AgentPanel from './components/AgentPanel';
import RuleDesign from './components/RuleDesign';
import DebugChat from './components/DebugChat';

// Phase 2: 错误页面
function ErrorScreen({ title, message }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="text-6xl mb-4">😕</div>
        <h1 className="text-2xl font-extrabold text-slate-800 mb-2">{title}</h1>
        <p className="text-slate-500">{message}</p>
      </div>
    </div>
  );
}

// Phase 2: Session 结束 banner
function SessionEndedBanner() {
  return (
    <div className="bg-amber-100 border-b-2 border-amber-200 px-4 py-2 text-center text-sm font-bold text-amber-800">
      ⚠️ Class ended. You can still play, but progress won't be saved.
    </div>
  );
}

// Main App wrapper with LanguageProvider
export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

// App content with language support
function AppContent() {
  const { language } = useLanguage();
  const t = useT();

  // Multi-lesson: Lesson config from session's lesson_type (not URL)
  // Now also uses language to get the right lesson config
  const [lessonType, setLessonType] = useState('lesson1');
  const [lessonConfig, setLessonConfig] = useState(() => getLessonConfig('lesson1', language));
  const currentLesson = lessonConfig?.lesson || LESSON;
  const currentTabs = lessonConfig?.tabs || TABS;

  // Update lesson config when language changes
  useEffect(() => {
    setLessonConfig(getLessonConfig(lessonType, language));
  }, [language, lessonType]);

  // Phase 2: Session & student 状态
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [sessionName, setSessionName] = useState('');
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsCode, setNeedsCode] = useState(false);  // 显示短码输入页
  const [codeError, setCodeError] = useState(null);   // 短码错误信息
  const [returningStudentDialog, setReturningStudentDialog] = useState(null); // 同名学生确认弹窗

  // Phase 1: App 状态
  const [tab, setTab] = useState("design");
  const [prevTab, setPrevTab] = useState("design");  // V17: 追踪前一个 tab
  const [choices, setChoices] = useState({});
  const [ownInputs, setOwnInputs] = useState({});
  const [gameName, setGameName] = useState("");

  // Lesson 2: Rule Design state
  const [rules, setRules] = useState({});

  // Lesson 2: Debug Log state
  const [debugEntries, setDebugEntries] = useState([]);

  // Phase 2: Upgrade 复制计数（用于 upgrade_retried）
  const [upgradeCopyCounts, setUpgradeCopyCounts] = useState({});

  // V17: Agent 状态
  const [agentGateActive, setAgentGateActive] = useState(false);
  const [agentPanelProps, setAgentPanelProps] = useState(null);
  const [completedUpgrades, setCompletedUpgrades] = useState([]);
  const [upgradeRecommendations, setUpgradeRecommendations] = useState({}); // Medium 参数推荐
  const [upgradeQuotes, setUpgradeQuotes] = useState({}); // Hard bestQuote
  const [upgradeDrafts, setUpgradeDrafts] = useState({}); // Hard draftPrompt (Agent生成的初始prompt)
  const [dynamicUpgradeConfig, setDynamicUpgradeConfig] = useState({}); // Medium Own Idea 动态params

  // Debug Multi-Agent 状态
  // null = 正常，prompt_tab_revisited 走 Gate 2
  // { type, debugSessionId } = Debug 执行后等待验证
  const [pendingVerification, setPendingVerification] = useState(null);

  // Phase 2: 初始化 session
  useEffect(() => {
    const initSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionParam = params.get('session');  // Legacy: full UUID
      const codeParam = params.get('code');        // New: 4-digit code

      if (!sessionParam && !codeParam) {
        // 没有参数，显示短码输入页
        setNeedsCode(true);
        setLoading(false);
        return;
      }

      // 查找 session（支持 UUID 或短码）
      let query = supabase.from('sessions').select('id, name, status, lesson_type');
      if (codeParam) {
        query = query.eq('join_code', codeParam);
      } else {
        query = query.eq('id', sessionParam);
      }

      const { data: session, error: sessionError } = await query.single();

      if (sessionError || !session) {
        setError({
          title: 'Class Not Found',
          message: codeParam ? 'Invalid code. Please check and try again.' : 'This class link is invalid.'
        });
        setLoading(false);
        return;
      }

      // 根据 session 的 lesson_type 自动加载对应课程
      const lessonKey = session.lesson_type || 'lesson1';
      setLessonType(lessonKey);
      console.log('Session loaded with lesson:', lessonKey);

      setSessionId(session.id);
      setSessionName(session.name);
      setSessionStatus(session.status);

      // 检查 localStorage 中的已有学生
      const storedStudentId = localStorage.getItem('student_id');
      const storedSessionId = localStorage.getItem('session_id');

      if (storedStudentId && storedSessionId === session.id) {
        // 验证学生仍存在
        const { data: student } = await supabase
          .from('students')
          .select('id, name, game_name')
          .eq('id', storedStudentId)
          .is('deleted_at', null)
          .single();

        if (student) {
          setStudentId(student.id);
          setStudentName(student.name);
          if (student.game_name) setGameName(student.game_name);
        }
      }

      setLoading(false);
    };

    initSession();
  }, []);

  // Phase 2: Event flush 定时器
  useEffect(() => {
    if (!studentId || sessionStatus === 'ended') return;
    const flushInterval = startEventFlush(supabase);
    return () => clearInterval(flushInterval);
  }, [studentId, sessionStatus]);

  // V17: AgentBridge 初始化
  useEffect(() => {
    if (sessionId && studentId && currentLesson) {
      agentBridge.init(sessionId, studentId, currentLesson, handleOpenAgentPanel);

      // 加载已完成 Gate 1 的 Upgrade 列表
      agentBridge.getCompletedUpgradeIds().then(ids => {
        setCompletedUpgrades(ids);
      });
    }
  }, [sessionId, studentId, currentLesson]);

  // V17: 打开 AgentPanel 的回调
  const handleOpenAgentPanel = (props) => {
    setAgentPanelProps(props);
    setAgentGateActive(true);
  };

  // V17: 关闭 AgentPanel
  const handleCloseAgentPanel = () => {
    setAgentGateActive(false);
    setAgentPanelProps(null);
  };

  // V17: Gate 1 完成回调（接收完整信息）
  // 注意：不在这里调用 handleCloseAgentPanel，因为 AgentPanel 的 handleClose 会在回调后调用 onClose
  const handleGate1Complete = ({ upgradeId, upgradeLevel, recommendations, bestQuote, draftPrompt, dynamicParams, promptTemplate }) => {
    setCompletedUpgrades(prev => [...prev, upgradeId]);

    // Medium Own Idea：存储动态params和template
    if (upgradeLevel === 'medium' && dynamicParams && promptTemplate) {
      setDynamicUpgradeConfig(prev => ({
        ...prev,
        [upgradeId]: { params: dynamicParams, template: promptTemplate }
      }));
    }
    // 普通 Medium Upgrade：存储参数推荐
    else if (upgradeLevel === 'medium' && recommendations?.recommendations) {
      setUpgradeRecommendations(prev => ({
        ...prev,
        [upgradeId]: recommendations.recommendations,
      }));
    }

    // Hard Upgrade：存储 bestQuote 和 draftPrompt
    if (upgradeLevel === 'hard') {
      if (bestQuote) {
        setUpgradeQuotes(prev => ({
          ...prev,
          [upgradeId]: bestQuote,
        }));
      }
      if (draftPrompt) {
        setUpgradeDrafts(prev => ({
          ...prev,
          [upgradeId]: draftPrompt,
        }));
      }
    }
    // Panel 关闭由 AgentPanel 的 onClose 处理
  };

  // V17: Start 按钮回调（触发 Gate 1）
  const handleStartUpgrade = (upgradeId, difficulty) => {
    agentBridge.trigger('upgrade_started', upgradeId, difficulty);
  };

  // Phase 2: 定期状态更新 (30秒)
  useEffect(() => {
    if (!studentId || sessionStatus === 'ended') return;

    const updateStatus = async () => {
      const displayGameName = gameName.trim() || currentLesson.defaultGameName(choices, ownInputs);
      await supabase
        .from('students')
        .update({
          current_step: tab,
          game_name: displayGameName,
          updated_at: new Date().toISOString()
        })
        .eq('id', studentId);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 30000);
    return () => clearInterval(interval);
  }, [studentId, tab, gameName, choices, ownInputs, sessionStatus]);

  // Phase 2: 检查 session 状态 (30秒)
  useEffect(() => {
    if (!sessionId) return;

    const checkSession = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('status')
        .eq('id', sessionId)
        .single();

      if (data) {
        setSessionStatus(data.status);
      }
    };

    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Phase 2: 学生名字提交（含去重检测）
  const handleNameSubmit = async (name) => {
    const trimmedName = name.trim();

    // Step 1：查询这个 session 里是否已有同名学生
    const { data: existing } = await supabase
      .from('students')
      .select('id, name, created_at')
      .eq('session_id', sessionId)
      .ilike('name', trimmedName)  // 大小写不敏感
      .maybeSingle();              // 不报错，没有返回 null

    if (existing) {
      // Step 2：发现同名 → 显示确认弹窗
      const confirmed = await showReturningStudentDialog(existing);

      if (confirmed) {
        // 学生确认「是我」→ 复用已有记录
        localStorage.setItem('student_id', existing.id);
        localStorage.setItem('session_id', sessionId);
        setStudentId(existing.id);
        setStudentName(existing.name);
        if (existing.game_name) setGameName(existing.game_name);
        return;
      } else {
        // 学生说「不是我」→ 创建新记录（名字加数字后缀区分）
        const newName = await resolveNameConflict(trimmedName, sessionId);
        await createNewStudent(newName);
        return;
      }
    }

    // Step 3：没有同名 → 正常创建
    await createNewStudent(trimmedName);
  };

  // 确认弹窗函数 - 返回 Promise<boolean>
  const showReturningStudentDialog = (existingStudent) => {
    return new Promise((resolve) => {
      setReturningStudentDialog({
        visible: true,
        studentName: existingStudent.name,
        onConfirm: () => {
          setReturningStudentDialog(null);
          resolve(true);
        },
        onDeny: () => {
          setReturningStudentDialog(null);
          resolve(false);
        },
      });
    });
  };

  // 名字冲突解决函数 - 如果有两个不同的人都叫 antony，第二个变成 antony (2)
  const resolveNameConflict = async (name, sessionId) => {
    const { data: conflicts } = await supabase
      .from('students')
      .select('name')
      .eq('session_id', sessionId)
      .ilike('name', `${name}%`);

    if (!conflicts || conflicts.length === 0) return name;
    return `${name} (${conflicts.length + 1})`;
  };

  // 创建新学生记录
  const createNewStudent = async (name) => {
    const deviceId = `${navigator.userAgent.slice(0, 50)}_${Date.now()}`;

    const { data: newStudent, error } = await supabase
      .from('students')
      .insert({
        session_id: sessionId,
        name: name,
        device_id: deviceId,
        current_step: 'design'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create student:', error);
      return;
    }

    // V17: Try to create signals record (table might not exist yet)
    try {
      await supabase
        .from('student_signals')
        .insert({ student_id: newStudent.id });
    } catch (e) {
      console.warn('Could not create signals record (table may not exist):', e);
    }

    localStorage.setItem('student_id', newStudent.id);
    localStorage.setItem('session_id', sessionId);

    setStudentId(newStudent.id);
    setStudentName(name);
  };

  // 短码提交处理
  const handleCodeSubmit = async (code) => {
    setCodeError(null);

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, name, status, lesson_type')
      .eq('join_code', code)
      .single();

    if (sessionError || !session) {
      setCodeError('Invalid code. Please check and try again.');
      return;
    }

    if (session.status === 'ended') {
      setCodeError('This class has ended.');
      return;
    }

    // 根据 session 的 lesson_type 自动加载对应课程
    const lessonKey = session.lesson_type || 'lesson1';
    setLessonType(lessonKey);
    console.log('Loaded lesson:', lessonKey);

    // 找到 session，更新状态
    setSessionId(session.id);
    setSessionName(session.name);
    setSessionStatus(session.status);
    setNeedsCode(false);
  };

  // Phase 2: Event 上报辅助函数
  const report = (eventType, dimension, data = {}) => {
    if (sessionStatus === 'ended') return;
    reportEvent(supabase, studentId, eventType, dimension, data);
  };

  // Phase 1: 重置游戏
  const resetGame = () => {
    setChoices({});
    setOwnInputs({});
    setGameName("");
    setTab("design");
  };

  // Phase 1: 检查是否全部选择完成
  const allChosen = currentLesson.steps.every((s) => {
    const v = choices[s.id];
    if (!v) return false;
    if (v === "__own__") return (ownInputs[s.id] || "").trim().length > 0;
    return true;
  });

  // Phase 1: 显示的游戏名称
  const displayGameName = gameName.trim() || currentLesson.defaultGameName(choices, ownInputs);
  const isCustomName = gameName.trim().length > 0;

  // Phase 2: Event handlers
  const handleGameNameSave = (newName, oldName) => {
    setGameName(newName);
    const isCustomName = newName.trim().length > 0;  // V17: 自定义名称判断
    if (oldName !== newName) {
      report('game_named', 'ownership', {
        old: oldName || displayGameName,
        new: newName,
        isCustomName  // V17: 携带是否自定义名称
      });
    }
  };

  const handleOwnIdeaSubmit = (stepId, text) => {
    report('own_idea_typed', 'ownership', { step: stepId, text });
  };

  const handleHelpOpen = (helpId) => {
    report('help_requested', 'persistence', { help_id: helpId });
  };

  const handleUpgradeCopy = (upgradeId, level) => {
    const key = `${upgradeId}_${level}`;
    const count = (upgradeCopyCounts[key] || 0) + 1;
    setUpgradeCopyCounts(prev => ({ ...prev, [key]: count }));

    // 每次都触发 upgrade_selected
    report('upgrade_selected', 'ownership', { upgrade_id: upgradeId, level, count });

    // 第2次开始额外触发 upgrade_retried
    if (count >= 2) {
      report('upgrade_retried', 'persistence', { upgrade_id: upgradeId, count });
    }
  };

  const handleLevelOpen = (level) => {
    if (level === 'medium') {
      report('medium_challenge_opened', 'curiosity', {});
    } else if (level === 'hard') {
      report('hard_challenge_opened', 'curiosity', {});
    }
  };

  // V17: prompt_generated 事件
  const handlePromptGenerated = () => {
    report('prompt_generated', null, {});
  };

  // V17: Tab 切换处理（检测 prompt_tab_revisited）
  const handleTabChange = (newTab) => {
    // 从 upgrade 或 help tab 切换到 prompt tab = revisited
    // 注意：用 tab（当前值）而不是 prevTab，因为 prevTab 可能是上上个 tab
    if (newTab === 'prompt' && (tab === 'upgrade' || tab === 'help' || tab === 'debug')) {
      // 说明之前已经访问过 prompt tab，现在从 help/upgrade/debug 切回来
      report('prompt_tab_revisited', null, { from: tab });

      // 检查是否有 Debug 验证待处理
      if (pendingVerification) {
        agentBridge.triggerDebugVerification(pendingVerification);
        setPendingVerification(null);
      } else {
        // V17 Gate 2 重设计：静默标记 pending 的 Upgrade 为 appeared=true
        // 不再弹出 Agent 对话框，学生无感知
        agentBridge.trigger('prompt_tab_revisited');
      }
    }
    setPrevTab(tab);
    setTab(newTab);
  };

  // V17: upgrade_own_idea_submitted 事件
  const handleOwnIdeaUpgrade = (text) => {
    report('upgrade_own_idea_submitted', null, { text });
  };

  // Loading 状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎮</div>
          <p className="text-slate-500 font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  // 需要输入短码
  if (needsCode) {
    return <CodeInput onSubmit={handleCodeSubmit} error={codeError} />;
  }

  // Error 状态
  if (error) {
    return <ErrorScreen title={error.title} message={error.message} />;
  }

  // 需要输入名字
  if (!studentId) {
    return (
      <>
        {/* 语言切换按钮（右上角） */}
        <div className="fixed top-4 right-4 z-50">
          <LanguageToggle />
        </div>
        <NameInput sessionName={sessionName} onSubmit={handleNameSubmit} />

        {/* 同名学生确认弹窗 */}
        {returningStudentDialog?.visible && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
              <div className="text-4xl text-center mb-3">👋</div>
              <h2 className="text-xl font-bold text-center mb-2">
                Welcome back, {returningStudentDialog.studentName}!
              </h2>
              <p className="text-slate-500 text-sm text-center mb-6">
                We found your game from earlier. Is this you?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={returningStudentDialog.onConfirm}
                  className="flex-1 bg-green-500 text-white rounded-xl py-3 font-bold text-sm hover:bg-green-600"
                >
                  ✓ Yes, that's me
                </button>
                <button
                  onClick={returningStudentDialog.onDeny}
                  className="flex-1 bg-slate-200 text-slate-700 rounded-xl py-3 font-bold text-sm hover:bg-slate-300"
                >
                  No, different person
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Phase 1 原版主界面 + V17 Agent 层
  return (
    <>
    {/* V17: 生产层（Agent 激活时变暗） */}
    <div
      className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50"
      style={{
        opacity: agentGateActive ? 0.3 : 1,
        pointerEvents: agentGateActive ? 'none' : 'auto',
        transition: 'opacity 0.3s',
      }}
    >
      {/* Phase 2: Session 结束 banner */}
      {sessionStatus === 'ended' && <SessionEndedBanner />}

      {/* Phase 1: Header */}
      <header className="border-b-2 border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-2xl flex-shrink-0">{currentLesson.emoji}</div>
          <GameNameBadge
            gameName={gameName}
            displayName={displayGameName}
            isCustom={isCustomName}
            onSave={handleGameNameSave}
          />
          <div className="flex-1" />
          <LanguageToggle />
        </div>
      </header>

      {/* Phase 1: Main content */}
      <main className="px-4 py-6 sm:py-10 pb-28">
        {tab === "design" && (
          <DesignCard
            choices={choices}
            setChoices={setChoices}
            ownInputs={ownInputs}
            setOwnInputs={setOwnInputs}
            onDone={() => {
              // For Lesson 2, go to Rules tab first; otherwise go to Prompt
              if (hasRuleDesign(lessonConfig)) {
                handleTabChange("rules");
              } else {
                handleTabChange("prompt");
              }
            }}
            onOwnIdeaSubmit={handleOwnIdeaSubmit}
            lessonConfig={lessonConfig}
          />
        )}
        {/* Lesson 2: Rule Design tab */}
        {tab === "rules" && hasRuleDesign(lessonConfig) && (
          <RuleDesign
            lessonConfig={lessonConfig}
            rules={rules}
            setRules={setRules}
            onDone={() => handleTabChange("prompt")}
          />
        )}
        {tab === "prompt" && (
          allChosen ? (
            <PromptGenerator
              choices={choices}
              ownInputs={ownInputs}
              gameName={displayGameName}
              onReset={resetGame}
              onPromptGenerated={handlePromptGenerated}
              lessonConfig={lessonConfig}
              rules={rules}
            />
          ) : (
            <div className="max-w-2xl mx-auto text-center py-12">
              <div className="text-4xl mb-3">👈</div>
              <p className="text-slate-600 mb-4">Finish building first!</p>
              <Button onClick={() => handleTabChange("design")} variant="primary">
                Go to Build
              </Button>
            </div>
          )
        )}
        {/* Debug Tab: 持久对话界面 */}
        {tab === "debug" && hasDebugLog(lessonConfig) && (
          <DebugChat
            studentId={studentId}
            sessionId={sessionId}
            currentPrompt={allChosen ? currentLesson.buildPrompt(choices, ownInputs, displayGameName, rules) : ''}
            pendingVerification={pendingVerification}
            setPendingVerification={setPendingVerification}
          />
        )}
        {tab === "help" && (
          <Recovery onHelpOpen={handleHelpOpen} lessonConfig={lessonConfig} />
        )}
        {tab === "upgrade" && (
          <Upgrade
            onUpgradeCopy={handleUpgradeCopy}
            onLevelOpen={handleLevelOpen}
            onOwnIdeaSubmit={handleOwnIdeaUpgrade}
            onStartUpgrade={handleStartUpgrade}
            completedUpgrades={completedUpgrades}
            upgradeRecommendations={upgradeRecommendations}
            upgradeQuotes={upgradeQuotes}
            upgradeDrafts={upgradeDrafts}
            dynamicUpgradeConfig={dynamicUpgradeConfig}
            lessonConfig={lessonConfig}
          />
        )}
      </main>

      {/* Phase 1: Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-100 z-10">
        <div className={`max-w-2xl mx-auto grid grid-cols-${currentTabs.length}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${currentTabs.length}, 1fr)` }}>
          {currentTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`py-3 flex flex-col items-center gap-1 transition-all ${
                  active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "scale-110" : ""}`} />
                <div className={`text-xs font-bold ${active ? "text-indigo-600" : ""}`}>{t.label}</div>
              </button>
            );
          })}
        </div>
      </nav>
    </div>

    {/* V17: Agent 层（z-index 高层） */}
    {agentGateActive && agentPanelProps && (
      <AgentPanel
        {...agentPanelProps}
        onClose={handleCloseAgentPanel}
        onGate1Complete={handleGate1Complete}
      />
    )}
    </>
  );
}
