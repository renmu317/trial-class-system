// Phase 1 原版 + Phase 2 session/event 管理
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { reportEvent, startEventFlush } from './lib/events';
import { LESSON, TABS } from './lib/lesson';

import NameInput from './components/NameInput';
import CodeInput from './components/CodeInput';
import GameNameBadge from './components/GameNameBadge';
import DesignCard from './components/DesignCard';
import PromptGenerator from './components/PromptGenerator';
import Recovery from './components/Recovery';
import Upgrade from './components/Upgrade';
import Button from './components/Button';

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

export default function App() {
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

  // Phase 1: App 状态
  const [tab, setTab] = useState("design");
  const [prevTab, setPrevTab] = useState("design");  // V17: 追踪前一个 tab
  const [choices, setChoices] = useState({});
  const [ownInputs, setOwnInputs] = useState({});
  const [gameName, setGameName] = useState("");

  // Phase 2: Upgrade 复制计数（用于 upgrade_retried）
  const [upgradeCopyCounts, setUpgradeCopyCounts] = useState({});

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
      let query = supabase.from('sessions').select('id, name, status');
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

  // Phase 2: 定期状态更新 (30秒)
  useEffect(() => {
    if (!studentId || sessionStatus === 'ended') return;

    const updateStatus = async () => {
      const displayGameName = gameName.trim() || LESSON.defaultGameName(choices, ownInputs);
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

  // Phase 2: 学生名字提交
  const handleNameSubmit = async (name) => {
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
      .select('id, name, status')
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
  const allChosen = LESSON.steps.every((s) => {
    const v = choices[s.id];
    if (!v) return false;
    if (v === "__own__") return (ownInputs[s.id] || "").trim().length > 0;
    return true;
  });

  // Phase 1: 显示的游戏名称
  const displayGameName = gameName.trim() || LESSON.defaultGameName(choices, ownInputs);
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
    // 从非 prompt tab 切换到 prompt tab = revisited
    if (newTab === 'prompt' && prevTab !== 'prompt' && prevTab !== 'design') {
      // 说明之前已经访问过 prompt tab，现在从 help/upgrade 切回来
      report('prompt_tab_revisited', null, { from: prevTab });
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
    return <NameInput sessionName={sessionName} onSubmit={handleNameSubmit} />;
  }

  // Phase 1 原版主界面
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Phase 2: Session 结束 banner */}
      {sessionStatus === 'ended' && <SessionEndedBanner />}

      {/* Phase 1: Header */}
      <header className="border-b-2 border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-2xl flex-shrink-0">{LESSON.emoji}</div>
          <GameNameBadge
            gameName={gameName}
            displayName={displayGameName}
            isCustom={isCustomName}
            onSave={handleGameNameSave}
          />
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
            onDone={() => handleTabChange("prompt")}
            onOwnIdeaSubmit={handleOwnIdeaSubmit}
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
        {tab === "help" && (
          <Recovery onHelpOpen={handleHelpOpen} />
        )}
        {tab === "upgrade" && (
          <Upgrade
            onUpgradeCopy={handleUpgradeCopy}
            onLevelOpen={handleLevelOpen}
            onOwnIdeaSubmit={handleOwnIdeaUpgrade}
          />
        )}
      </main>

      {/* Phase 1: Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-100 z-10">
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {TABS.map((t) => {
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
  );
}
