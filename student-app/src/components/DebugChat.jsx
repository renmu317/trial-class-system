/**
 * DebugChat - 持久对话界面
 *
 * 2026-05-24: 从弹窗改为持久界面
 * 2026-05-26: V17 Phase B 重构 - 集成新架构
 *
 * - 左侧：Chat 历史列表
 * - 右侧：当前对话窗口
 * - 对话历史存储在 debug_sessions.conversation_history
 *
 * 新架构：
 * - 使用 RoundCounter 替代 roundNumber/toolRound 状态
 * - 使用 callAgent 替代 callDebugAgent
 * - 使用 prompts/*.js 中的 System Prompt 构建函数
 * - 使用 preCheckInput 进行代码层输入验证
 */

import { useState, useEffect, useRef } from 'react';
import { Plus, Send, CheckCircle, Circle, MessageCircle, Camera, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// V17 Phase B: 新架构导入
import { RoundCounter, preCheckInput, getMaxRounds, INVALID_RESPONSE_TEMPLATES } from '../lib/agentGuards';
import { callAgent, callAgentDirect } from '../lib/agentCaller';
import { buildOrchestratorPrompt } from '../lib/prompts/debugOrchestratorPrompt';
import { buildPromptToolPrompt } from '../lib/prompts/debugPromptToolPrompt';
import { buildCodeToolPrompt, buildResetToolPrompt } from '../lib/prompts/debugCodeToolPrompt';
import { addRouteMarker, compressTool, compressChat, trimConversationHistory } from '../lib/conversationHistory';
import {
  writeDebugMessage,
  writeDebugToolSwitch,
  writeDebugComplete,
  formatForDebug,
  getTimeline,
  invalidateCache
} from '../lib/timeline';

// V17 Phase B: 从 timeline 获取成功的 Upgrade（用于 Reset Tool）
import { getSuccessfulUpgrades as getSuccessfulUpgradesFromTimeline } from '../lib/timeline';

// 确认词正则（用于 isFirstAfterRoute 检测）
const CONFIRMATION_WORDS = /^(ok|okay|yes|no|sure|good|great|yeah|yep|got\s*it|fine|alright|k|y|n)\.?$/i;

// Supabase Edge Function URL for DeepSeek proxy (用于 vision 模式)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEEPSEEK_PROXY_URL = `${SUPABASE_URL}/functions/v1/deepseek-proxy`;

// =====================================================
// 子组件：ChatSidebar — 左边历史列表
// =====================================================

function ChatSidebar({ chatList, activeChatId, onSelectChat, onNewChat }) {
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  return (
    <div className="w-44 border-r border-slate-200 flex flex-col bg-slate-50">
      {/* New Chat 按钮 */}
      <button
        onClick={onNewChat}
        className="m-3 flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors"
      >
        <Plus size={16} /> New Chat
      </button>

      {/* Chat 列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {chatList.length === 0 && (
          <p className="text-xs text-slate-400 text-center mt-4 px-2">
            No debug chats yet. Click "New Chat" to start!
          </p>
        )}
        {chatList.map(chat => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl mb-1.5 transition-colors ${
              activeChatId === chat.id
                ? 'bg-orange-100 border border-orange-300'
                : 'hover:bg-white border border-transparent'
            }`}
          >
            <div className="font-medium text-slate-700 text-xs truncate leading-tight">
              {chat.chat_title || 'Debug session'}
            </div>
            <div className="text-slate-400 text-xs mt-1">
              {formatTimeAgo(chat.started_at)}
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              chat.resolved ? 'text-green-600' : 'text-orange-500'
            }`}>
              {chat.resolved ? (
                <><CheckCircle size={10} /> resolved</>
              ) : (
                <><Circle size={10} className="fill-current" /> active</>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// 子组件：ExecutionUI — 放行时显示 fix 框
// =====================================================

function ExecutionUI({ payload, onGoGenerate }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(payload.fixText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const colorMap = {
    prompt_fix: { bg: 'bg-green-50', border: 'border-green-200', btn: 'bg-green-500 hover:bg-green-600' },
    code_fix: { bg: 'bg-blue-50', border: 'border-blue-200', btn: 'bg-blue-500 hover:bg-blue-600' },
    reset: { bg: 'bg-purple-50', border: 'border-purple-200', btn: 'bg-purple-500 hover:bg-purple-600' },
  };
  const colors = colorMap[payload.type] || colorMap.prompt_fix;

  return (
    <div className={`rounded-xl border p-4 mt-2 ${colors.bg} ${colors.border}`}>
      <p className="text-sm font-bold mb-2 text-slate-700">
        {payload.type === 'prompt_fix' && 'Add this to your prompt, then regenerate:'}
        {payload.type === 'code_fix' && 'Send this to Claude to fix the code:'}
        {payload.type === 'reset' && 'Use this new prompt to regenerate:'}
      </p>
      <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-sm mb-3 whitespace-pre-wrap">
        {payload.fixText}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50 transition-colors"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
        <button
          onClick={onGoGenerate}
          className={`px-4 py-2 text-white rounded-lg text-sm font-bold transition-colors ${colors.btn}`}
        >
          Go Generate →
        </button>
      </div>
    </div>
  );
}

// =====================================================
// 子组件：UpgradeSelector — Reset 时选择保留的功能
// =====================================================

function UpgradeSelector({ upgrades, selected, onSelect, onConfirm }) {
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mt-2">
      <p className="text-sm font-bold text-purple-800 mb-3">Select features to keep:</p>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {upgrades.map((u, i) => (
          <label key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-purple-100 transition-colors">
            <input
              type="checkbox"
              checked={selected.includes(u.label)}
              onChange={(e) => {
                if (e.target.checked) {
                  onSelect([...selected, u.label]);
                } else {
                  onSelect(selected.filter(x => x !== u.label));
                }
              }}
              className="w-4 h-4 text-purple-500 rounded"
            />
            <span className="text-sm text-slate-700">{u.label}</span>
          </label>
        ))}
      </div>
      <button
        onClick={onConfirm}
        className="w-full mt-3 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
      >
        Continue →
      </button>
    </div>
  );
}

// =====================================================
// 子组件：ChatWindow — 右边对话窗口
// =====================================================

function ChatWindow({
  messages,
  isLoading,
  inputText,
  onInputChange,
  onSend,
  executionPayload,
  onGoGenerate,
  showUpgradeSelector,
  successfulUpgrades,
  selectedUpgrades,
  onSelectUpgrades,
  onConfirmUpgrades,
  hasActiveChat,
  pendingImage,
  onImageSelect,
  onRemoveImage,
  imageInputRef,
}) {
  const messagesEndRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!hasActiveChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Click "New Chat" to start debugging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-orange-500 text-white rounded-br-sm'
                : msg.role === 'system'
                  ? 'bg-yellow-50 text-yellow-800 rounded-bl-sm border border-yellow-200'
                  : 'bg-slate-100 text-slate-700 rounded-bl-sm'
            }`}>
              {/* Display image if message has one */}
              {msg.imagePreview && (
                <img
                  src={msg.imagePreview}
                  alt="Screenshot"
                  className="rounded-lg mb-2 max-w-full cursor-pointer hover:opacity-90"
                  onClick={() => window.open(msg.imagePreview, '_blank')}
                />
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {/* 执行层 UI：放行时显示 fix prompt 框 */}
        {executionPayload && (
          <ExecutionUI payload={executionPayload} onGoGenerate={onGoGenerate} />
        )}

        {/* Reset 时的 Upgrade 选择器 */}
        {showUpgradeSelector && (
          <UpgradeSelector
            upgrades={successfulUpgrades}
            selected={selectedUpgrades}
            onSelect={onSelectUpgrades}
            onConfirm={onConfirmUpgrades}
          />
        )}

        {/* 加载中 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-4 py-2.5 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image preview area */}
      {pendingImage && !executionPayload && !showUpgradeSelector && (
        <div className="px-3 pt-2">
          <div className="relative inline-block">
            <img
              src={pendingImage.preview}
              alt="Pending screenshot"
              className="h-20 rounded-lg border border-slate-200"
            />
            <button
              onClick={onRemoveImage}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* 输入框 */}
      {!executionPayload && !showUpgradeSelector && (
        <div className="p-3 border-t border-slate-200 flex gap-2">
          {/* Hidden file input */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageSelect(file);
              e.target.value = ''; // Reset to allow same file selection
            }}
            className="hidden"
          />
          {/* Image upload button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading}
            className={`border-2 rounded-xl px-3 py-2.5 transition-colors ${
              pendingImage
                ? 'border-orange-400 bg-orange-50 text-orange-600'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
            } disabled:opacity-50`}
            title="Add screenshot"
          >
            <Camera size={18} />
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
            placeholder={pendingImage ? "Describe what's wrong (optional)..." : "Describe what's happening..."}
            disabled={isLoading}
            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={onSend}
            disabled={(!inputText.trim() && !pendingImage) || isLoading}
            className="bg-orange-500 text-white rounded-xl px-4 py-2.5 hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================
// 主组件：DebugChat
// =====================================================

export default function DebugChat({
  studentId,
  sessionId,
  currentPrompt,
  lessonType,
  pendingVerification,
  setPendingVerification,
}) {
  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState('debug_orchestrator');
  const [bugSummary, setBugSummary] = useState('');
  const [isFirstAfterRoute, setIsFirstAfterRoute] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [executionPayload, setExecutionPayload] = useState(null);

  // V17 Phase B: 使用 RoundCounter ref 替代 state
  const orchestratorRoundCounter = useRef(new RoundCounter());
  const toolRoundCounter = useRef(new RoundCounter());

  // Reset Phase 1 状态
  const [resetStep, setResetStep] = useState(1);
  const [showUpgradeSelector, setShowUpgradeSelector] = useState(false);
  const [selectedUpgrades, setSelectedUpgrades] = useState([]);
  const [successfulUpgrades, setSuccessfulUpgrades] = useState([]);

  // Orchestrator Q1-Q4 状态追踪
  const [qState, setQState] = useState({
    q1: null,  // 'running' | 'crashed'
    q2: null,  // 'one' | 'multiple'
    q3: null,  // 'missing' | 'wrong'
    q4: null,  // 'opposite' | 'detail'
  });

  // Image upload state
  const [pendingImage, setPendingImage] = useState(null);
  const imageInputRef = useRef(null);

  // 初始化：加载 chat 列表 + Realtime subscription
  useEffect(() => {
    if (!studentId) return;

    loadChatList();

    const subscription = supabase
      .channel(`debug_sessions_${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debug_sessions',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log('Debug sessions change:', payload);
          loadChatList();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [studentId]);

  // 切换到已有 chat
  useEffect(() => {
    if (activeChatId) {
      loadChatMessages(activeChatId);
    }
  }, [activeChatId]);

  // 处理 pending verification（从 Claude 返回后）
  useEffect(() => {
    if (pendingVerification && activeChatId) {
      handleVerificationReturn();
    }
  }, [pendingVerification]);

  // =====================================================
  // 数据加载函数
  // =====================================================

  const loadChatList = async () => {
    const { data } = await supabase
      .from('debug_sessions')
      .select('id, chat_title, started_at, resolved, bug_type')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(20);

    setChatList(data || []);
  };

  const loadChatMessages = async (chatId) => {
    const { data } = await supabase
      .from('debug_sessions')
      .select('conversation_history, current_mode, resolved, bug_description')
      .eq('id', chatId)
      .single();

    if (data) {
      setMessages(data.conversation_history || []);
      setCurrentMode(data.current_mode || 'debug_orchestrator');
      setBugSummary(data.bug_description || '');
      setExecutionPayload(null);
      setShowUpgradeSelector(false);

      // V17 Phase B: 从对话历史计算 round
      const userMessages = (data.conversation_history || []).filter(m => m.role === 'user');
      if (data.current_mode === 'debug_orchestrator') {
        orchestratorRoundCounter.current = new RoundCounter();
        for (let i = 0; i < userMessages.length; i++) {
          orchestratorRoundCounter.current.increment();
        }
      } else {
        // 找到最后一个路由标记，计算之后的 user 消息数
        const history = data.conversation_history || [];
        const lastRouteIdx = history.reduce((acc, t, i) =>
          t.content?.includes('[ROUTED-TO-') ? i : acc, -1);
        const messagesAfterRoute = lastRouteIdx >= 0 ? history.slice(lastRouteIdx) : history;
        const toolUserMessages = messagesAfterRoute.filter(m => m.role === 'user');

        toolRoundCounter.current = new RoundCounter();
        for (let i = 0; i < toolUserMessages.length; i++) {
          toolRoundCounter.current.increment();
        }
      }
    }
  };

  const updateChatHistory = async (chatId, newMessages) => {
    // 深度清理每条消息，确保可序列化
    const dbMessages = newMessages.map(m => {
      // 1. 移除所有 blob/临时字段
      const { imagePreview, imageData, blob, file, _temp, ...rest } = m;

      // 2. 处理 content 字段
      let safeContent = rest.content;

      // 如果 content 是数组（vision 模式），提取文本部分
      if (Array.isArray(safeContent)) {
        const textParts = safeContent
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(' ');
        safeContent = textParts || '[Image message]';
      }

      // 如果 content 不是字符串，转换为字符串
      if (typeof safeContent !== 'string') {
        try {
          safeContent = JSON.stringify(safeContent);
        } catch {
          safeContent = String(safeContent || '');
        }
      }

      // 3. 限制 content 长度（防止超大消息）
      if (safeContent.length > 10000) {
        safeContent = safeContent.slice(0, 10000) + '... [truncated]';
      }

      return {
        role: rest.role || 'user',
        content: safeContent,
        timestamp: rest.timestamp || new Date().toISOString(),
      };
    });

    // 序列化测试
    try {
      const jsonStr = JSON.stringify(dbMessages);
      // 检查总大小（Supabase jsonb 有限制）
      if (jsonStr.length > 500000) {
        console.warn('[DebugChat] Message history too large, truncating older messages');
        // 只保留最近 20 条消息
        const truncated = dbMessages.slice(-20);
        await supabase.from('debug_sessions').update({
          conversation_history: truncated,
        }).eq('id', chatId);
        return;
      }
    } catch (e) {
      console.error('[DebugChat] JSON serialization failed:', e);
      // 最后回退：只保留最近 10 条的基本信息
      const safeMessages = dbMessages.slice(-10).map(m => ({
        role: String(m.role || 'user'),
        content: String(m.content || '').slice(0, 500),
        timestamp: m.timestamp,
      }));
      await supabase.from('debug_sessions').update({
        conversation_history: safeMessages,
      }).eq('id', chatId);
      return;
    }

    const { error } = await supabase.from('debug_sessions').update({
      conversation_history: dbMessages,
    }).eq('id', chatId);

    if (error) {
      console.error('[DebugChat] updateChatHistory error:', error.code, error.message);
      // 如果还是失败，尝试最小化保存
      if (error.code === 'PGRST204' || error.message?.includes('too large')) {
        const minimal = dbMessages.slice(-10).map(m => ({
          role: m.role,
          content: m.content.slice(0, 200),
          timestamp: m.timestamp,
        }));
        await supabase.from('debug_sessions').update({
          conversation_history: minimal,
        }).eq('id', chatId);
      }
    }
  };

  const generateChatTitle = async (chatId, firstUserMessage) => {
    const title = firstUserMessage.slice(0, 30) + (firstUserMessage.length > 30 ? '...' : '');
    await supabase.from('debug_sessions').update({
      chat_title: title,
    }).eq('id', chatId);
    await loadChatList();
  };

  // =====================================================
  // 构建 System Prompt (使用新架构的 prompts + timeline)
  // =====================================================

  const buildSystemPrompt = async (mode) => {
    // V17 Phase B: 使用 getTimeline + formatForDebug 替代 buildStudentContext
    const timeline = await getTimeline(studentId, sessionId);
    const contextString = formatForDebug(timeline, currentPrompt);

    if (mode === 'debug_orchestrator') {
      return buildOrchestratorPrompt(contextString, orchestratorRoundCounter.current.get(), qState);
    } else if (mode === 'debug_prompt') {
      const maxRounds = getMaxRounds('debug_prompt');
      return buildPromptToolPrompt(contextString, bugSummary, toolRoundCounter.current.get(), maxRounds, {
        attemptCount,
        isFirstAfterRoute,
      });
    } else if (mode === 'debug_code') {
      const maxRounds = getMaxRounds('debug_code');
      return buildCodeToolPrompt(contextString, bugSummary, toolRoundCounter.current.get(), maxRounds, {
        attemptCount,
      });
    } else if (mode === 'debug_reset_phase1') {
      // 从 timeline 获取成功的 Upgrade 列表
      const upgrades = getSuccessfulUpgradesFromTimeline(timeline);
      setSuccessfulUpgrades(upgrades);
      return buildResetToolPrompt(contextString, bugSummary, resetStep, selectedUpgrades, attemptCount);
    }

    return '';
  };

  // =====================================================
  // Image handling
  // =====================================================

  const handleImageSelect = (file) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('Image too large. Maximum size is 2MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingImage({
        base64: e.target.result,
        type: file.type,
        preview: URL.createObjectURL(file)
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    if (pendingImage?.preview) {
      URL.revokeObjectURL(pendingImage.preview);
    }
    setPendingImage(null);
  };

  // =====================================================
  // 事件处理
  // =====================================================

  const handleNewChat = async () => {
    // 1. 创建新的 debug_session 记录
    const { data: newChat, error } = await supabase
      .from('debug_sessions')
      .insert({
        student_id: studentId,
        session_id: sessionId,
        bug_type: 'pending',
        conversation_history: [],
        current_mode: 'debug_orchestrator',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create debug session:', error);
      return;
    }

    // 2. 重置所有状态
    setActiveChatId(newChat.id);
    setCurrentMode('debug_orchestrator');
    setMessages([]);
    setAttemptCount(0);
    setBugSummary('');
    setExecutionPayload(null);
    setShowUpgradeSelector(false);
    setResetStep(1);
    setSelectedUpgrades([]);
    setQState({ q1: null, q2: null, q3: null, q4: null });

    // V17 Phase B: 重置 RoundCounter
    orchestratorRoundCounter.current.reset();
    toolRoundCounter.current.reset();

    setIsLoading(true);

    try {
      // 3. 构建 System Prompt 并调用 Agent
      const systemPrompt = await buildSystemPrompt('debug_orchestrator');
      const response = await callAgentDirect({
        systemPrompt,
        messages: [],
        maxTokens: 500,
      });

      // 4. 显示第一句话
      const initialMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };
      setMessages([initialMessage]);

      // 5. 写入 DB
      await updateChatHistory(newChat.id, [initialMessage]);
    } catch (error) {
      console.error('Failed to start debug chat:', error);
      setMessages([{
        role: 'assistant',
        content: "Hi! What's going wrong with your game?",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      await loadChatList();
    }
  };

  // Q状态更新（根据学生回答推断）
  const updateQState = (qAsked, userInput) => {
    const input = userInput.toLowerCase();

    setQState(prev => {
      const newState = { ...prev };

      if (qAsked === 'Q1') {
        if (input.includes('crash') || input.includes('froze') || input.includes('frozen') || input.includes('stuck') || input.includes('broke')) {
          newState.q1 = 'crashed';
        } else {
          newState.q1 = 'running';
        }
      } else if (qAsked === 'Q2') {
        if (input.includes('multiple') || input.includes('many') || input.includes('lot') || input.includes('everything') || input.includes('all')) {
          newState.q2 = 'multiple';
        } else {
          newState.q2 = 'one';
        }
      } else if (qAsked === 'Q3') {
        if (input.includes('missing') || input.includes('not there') || input.includes('don\'t see') || input.includes('no ') || input.includes('didn\'t appear')) {
          newState.q3 = 'missing';
        } else {
          newState.q3 = 'wrong';
        }
      } else if (qAsked === 'Q4') {
        if (input.includes('opposite') || input.includes('reverse') || input.includes('backward') || input.includes('instead')) {
          newState.q4 = 'opposite';
        } else {
          newState.q4 = 'detail';
        }
      }

      return newState;
    });
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !pendingImage) || isLoading || !activeChatId) return;

    const hasImage = !!pendingImage;
    const textContent = inputText.trim() || (hasImage ? 'Please analyze this screenshot.' : '');

    console.log('[DebugChat] handleSend:', {
      currentMode,
      orchestratorRound: orchestratorRoundCounter.current.get(),
      toolRound: toolRoundCounter.current.get(),
      inputText: textContent,
      hasImage,
      isFirstAfterRoute
    });

    // V17 Phase B 问题3修复：路由刚切换后的第一条消息
    // 如果是确认词（ok/yes），直接忽略，Tool 开场已经由 Agent 生成
    if (isFirstAfterRoute && !hasImage) {
      if (CONFIRMATION_WORDS.test(textContent.trim())) {
        console.log('[DebugChat] Ignoring confirmation word after route switch');
        setInputText('');
        setIsFirstAfterRoute(false);
        return;
      }
      setIsFirstAfterRoute(false);
    }

    // V17 Phase B: 代码层预检（仅非图片模式）
    if (!hasImage) {
      const currentRound = currentMode === 'debug_orchestrator'
        ? orchestratorRoundCounter.current.get()
        : toolRoundCounter.current.get();

      const preCheck = preCheckInput(textContent, currentMode, currentRound);

      if (!preCheck.shouldCallModel) {
        // 明显无效输入：直接追问，不调用 API
        if (preCheck.directResponse) {
          console.log('[DebugChat] Skipping API call - invalid input:', preCheck.reason);

          const userMessage = {
            role: 'user',
            content: textContent,
            timestamp: new Date().toISOString(),
          };
          const assistantMessage = {
            role: 'assistant',
            content: preCheck.directResponse,
            timestamp: new Date().toISOString(),
          };

          const updatedMessages = [...messages, userMessage, assistantMessage];
          setMessages(updatedMessages);
          setInputText('');
          await updateChatHistory(activeChatId, updatedMessages);

          // 第一次用户消息时生成标题
          if (messages.filter(m => m.role === 'user').length === 0) {
            await generateChatTitle(activeChatId, textContent);
          }
          return;
        }

        // V17 Phase B 问题2修复：超过最大轮次，强制放行，不调用 API
        if (preCheck.forceRelease) {
          console.log('[DebugChat] Force release due to max rounds');

          const userMessage = {
            role: 'user',
            content: textContent,
            timestamp: new Date().toISOString(),
          };
          const forceMessage = {
            role: 'assistant',
            content: "Okay, let's try your fix and see if it works.",
            timestamp: new Date().toISOString(),
          };

          const updatedMessages = [...messages, userMessage, forceMessage];
          setMessages(updatedMessages);
          setInputText('');
          await updateChatHistory(activeChatId, updatedMessages);

          // 设置放行 payload
          setExecutionPayload({
            type: currentMode === 'debug_prompt' ? 'prompt_fix' :
                  currentMode === 'debug_code' ? 'code_fix' : 'reset',
            fixText: textContent,
          });

          return;
        }
      }
    }

    // Build user message
    const userMessage = {
      role: 'user',
      content: hasImage ? `[Screenshot attached] ${textContent}` : textContent,
      timestamp: new Date().toISOString(),
      ...(hasImage && { imagePreview: pendingImage.preview }),
    };

    // 1. 立刻显示学生消息
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    const currentImage = pendingImage;
    setPendingImage(null);
    setIsLoading(true);

    // 2. 写入 DB（乐观更新）
    await updateChatHistory(activeChatId, updatedMessages);

    try {
      let response;

      if (hasImage) {
        // Vision 模式：直接调用 API
        const messagesForApi = updatedMessages.map(m => {
          if (m === userMessage) {
            return {
              role: 'user',
              content: [
                { type: 'text', text: `Student is debugging their game. They say: "${textContent}". Analyze this screenshot and help identify what might be wrong.` },
                { type: 'image_url', image_url: { url: currentImage.base64 } }
              ]
            };
          }
          return { role: m.role, content: m.content };
        });

        response = await callAgentDirect({
          systemPrompt: 'You are a helpful game debugging assistant. Analyze the screenshot and help identify issues.',
          messages: messagesForApi,
          maxTokens: 800,
          hasImage: true,
        });
      } else {
        // V17 Phase B: 使用新的 callAgent 函数
        const systemPrompt = await buildSystemPrompt(currentMode);
        const currentRound = currentMode === 'debug_orchestrator'
          ? orchestratorRoundCounter.current.get()
          : toolRoundCounter.current.get();

        response = await callAgent({
          mode: currentMode,
          userInput: textContent,
          currentRound,
          systemPrompt,
          conversationHistory: updatedMessages,
          maxTokens: currentMode === 'debug_orchestrator' ? 500 : 800,
        });
      }

      // 处理代码层跳过 API 的情况
      if (response.skippedModel) {
        console.log('[DebugChat] Model was skipped:', response.reason);
      }

      // 更新 Q 状态（Orchestrator 模式下追踪 Q1-Q4）
      if (currentMode === 'debug_orchestrator' && response.q_asked) {
        updateQState(response.q_asked, textContent);
      }

      // 处理路由（Orchestrator 分类后切换 mode）
      if (response.route && response.route !== 'pending') {
        // 路由时，先添加 Orchestrator 的最终响应，再添加路由标记
        const messagesBeforeRoute = [...updatedMessages, {
          role: 'assistant',
          content: response.response,
          timestamp: new Date().toISOString(),
        }];
        await handleRoute(response.route, response.bug_summary, response.related_upgrade, messagesBeforeRoute);
        // 路由后直接返回，不再执行后续的 setMessages
        return;
      }

      // 处理 Reset Phase 1 的步骤切换
      if (currentMode === 'debug_reset_phase1') {
        if (response.show_upgrade_selector) {
          setShowUpgradeSelector(true);
          setResetStep(2);
        } else if (response.step) {
          setResetStep(response.step);
        }
        if (response.step === 3) {
          setAttemptCount(prev => prev + 1);
        }
      }

      // 检查是否放行
      let payload = null;
      if (response.ready_to_execute || response.forceReleased) {
        console.log('[DebugChat] Ready to execute!');
        const fixText = response.student_fix || response.final_fix_request || response.final_new_prompt || textContent;
        if (fixText) {
          payload = {
            type: currentMode === 'debug_prompt' ? 'prompt_fix' :
                  currentMode === 'debug_code' ? 'code_fix' : 'reset',
            fixText,
          };
          console.log('[DebugChat] Execution payload:', payload);
          setExecutionPayload(payload);
        }
      }

      // 构建助手消息
      const assistantMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      // 更新 UI 和 DB
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await updateChatHistory(activeChatId, finalMessages);

      // V17 Phase B: 更新 round（使用 RoundCounter）
      if (currentMode === 'debug_orchestrator') {
        if (response.continue !== false) {
          orchestratorRoundCounter.current.increment();
          console.log('[DebugChat] Orchestrator round incremented to:', orchestratorRoundCounter.current.get());
        }
      } else {
        if (response.continue !== false) {
          toolRoundCounter.current.increment();
          console.log('[DebugChat] Tool round incremented to:', toolRoundCounter.current.get());
        } else {
          console.log('[DebugChat] Tool round NOT incremented (continue=false), staying at:', toolRoundCounter.current.get());
        }
      }

      // 自动生成 chat 标题
      if (updatedMessages.filter(m => m.role === 'user').length === 1) {
        await generateChatTitle(activeChatId, userMessage.content);
      }

    } catch (error) {
      console.error('Debug agent error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoute = async (route, summary, relatedUpgrade, currentMessages) => {
    console.log('[DebugChat] handleRoute:', { route, summary, relatedUpgrade });

    const modeMap = {
      prompt_tool: 'debug_prompt',
      code_tool: 'debug_code',
      reset_tool: 'debug_reset_phase1',
      no_bug: null,
    };
    const newMode = modeMap[route];
    console.log('[DebugChat] Switching mode:', { from: currentMode, to: newMode });

    if (route === 'no_bug') {
      await supabase.from('debug_sessions').update({
        resolved: true,
      }).eq('id', activeChatId);
      await loadChatList();
      return;
    }

    // V17 Phase B: 添加路由标记到对话历史
    const messagesWithMarker = addRouteMarker(currentMessages, route, summary);
    setMessages(messagesWithMarker);
    await updateChatHistory(activeChatId, messagesWithMarker);

    // 写入时间线（如果 timeline 表存在）
    try {
      await writeDebugToolSwitch(studentId, sessionId, newMode, summary, lessonType);
    } catch (e) {
      console.log('[DebugChat] Timeline write skipped (table may not exist yet)');
    }

    // 更新状态
    setCurrentMode(newMode);
    setBugSummary(summary || '');
    setIsFirstAfterRoute(true);
    setAttemptCount(0);

    // V17 Phase B: 重置 Tool round counter
    toolRoundCounter.current.reset();
    console.log('[DebugChat] handleRoute: Tool round reset to 1, isFirstAfterRoute=true');

    // 更新 DB 记录
    await supabase.from('debug_sessions').update({
      bug_type: route === 'prompt_tool' ? 'prompt' :
                route === 'code_tool' ? 'code' : 'reset',
      current_mode: newMode,
      bug_description: summary,
      related_upgrade_id: relatedUpgrade,
    }).eq('id', activeChatId);
  };

  const handleGoGenerate = async () => {
    // V17 Phase B: 压缩对话历史
    if (executionPayload?.fixText) {
      const compressedMessages = compressTool(messages, executionPayload.type.replace('_fix', ''), executionPayload.fixText);
      // 不立即更新 UI，只在完成时写入

      // 写入时间线
      try {
        await writeDebugComplete(studentId, sessionId, currentMode.replace('debug_', ''), executionPayload.fixText, false, lessonType);
      } catch (e) {
        console.log('[DebugChat] Timeline write skipped');
      }
    }

    // 设置 pendingVerification
    setPendingVerification({
      type: currentMode.replace('debug_', '').replace('_phase1', ''),
      debugSessionId: activeChatId,
    });

    // 在对话里显示提示
    const goMessage = {
      role: 'assistant',
      content: 'Great! Go to Claude and generate your game. Come back and tell me if it worked!',
      timestamp: new Date().toISOString(),
    };
    const finalMessages = [...messages, goMessage];
    setMessages(finalMessages);
    await updateChatHistory(activeChatId, finalMessages);

    setExecutionPayload(null);
  };

  const handleConfirmUpgrades = async () => {
    setShowUpgradeSelector(false);
    setResetStep(3);

    const selectionMessage = selectedUpgrades.length > 0
      ? `I want to keep: ${selectedUpgrades.join(', ')}`
      : 'I want to start completely fresh';

    setInputText(selectionMessage);
    setTimeout(() => {
      setInputText('');
      handleSend();
    }, 100);
  };

  const handleVerificationReturn = async () => {
    const verifyMessage = {
      role: 'assistant',
      content: executionPayload?.type === 'reset'
        ? 'Welcome back! Is your new game running?'
        : 'Welcome back! Did the fix work? Is your game working now?',
      timestamp: new Date().toISOString(),
    };

    const finalMessages = [...messages, verifyMessage];
    setMessages(finalMessages);
    await updateChatHistory(activeChatId, finalMessages);

    setPendingVerification(null);
  };

  // =====================================================
  // 渲染
  // =====================================================

  return (
    <div className="flex h-full bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 pb-16">
      {/* 左边：Chat 历史列表 */}
      <ChatSidebar
        chatList={chatList}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={handleNewChat}
      />

      {/* 右边：当前对话 */}
      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        inputText={inputText}
        onInputChange={setInputText}
        onSend={handleSend}
        executionPayload={executionPayload}
        onGoGenerate={handleGoGenerate}
        showUpgradeSelector={showUpgradeSelector}
        successfulUpgrades={successfulUpgrades}
        selectedUpgrades={selectedUpgrades}
        onSelectUpgrades={setSelectedUpgrades}
        onConfirmUpgrades={handleConfirmUpgrades}
        hasActiveChat={!!activeChatId}
        pendingImage={pendingImage}
        onImageSelect={handleImageSelect}
        onRemoveImage={handleRemoveImage}
        imageInputRef={imageInputRef}
      />
    </div>
  );
}
