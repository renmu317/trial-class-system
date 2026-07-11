/**
 * DebugChat - 持久对话界面
 *
 * 2026-05-24: 从弹窗改为持久界面
 * 2026-05-26: V17 Phase B 重构 - 集成新架构
 * 2026-07-11: 方案 B - 统一 Debug Agent（去掉 Orchestrator + Tools 分离）
 *
 * - 左侧：Chat 历史列表
 * - 右侧：当前对话窗口
 * - 对话历史存储在 debug_sessions.conversation_history
 *
 * 方案 B 架构：
 * - 单一 RoundCounter
 * - 单一统一 Agent，直接帮助学生
 * - 无 mode 切换，无分类追问
 */

import { useState, useEffect, useRef } from 'react';
import { Plus, Send, CheckCircle, Circle, MessageCircle, Camera, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { useT } from '../i18n';

// 方案 B: 统一 Debug Agent
import { RoundCounter } from '../lib/agentGuards';
import { callAgent, callAgentDirect } from '../lib/agentCaller';
import { buildUnifiedDebugPrompt, buildResetConfirmPrompt } from '../lib/prompts/unifiedDebugPrompt';
import { buildResolutionJudgePrompt } from '../lib/prompts/resolutionJudgePrompt';
import {
  writeDebugComplete,
  writeEvent,
  formatForDebug,
  getTimeline,
  getSuccessfulUpgrades as getSuccessfulUpgradesFromTimeline
} from '../lib/timeline';

// =====================================================
// 子组件：ChatSidebar — 左边历史列表
// =====================================================

function ChatSidebar({ chatList, activeChatId, onSelectChat, onNewChat, t }) {
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 60000) return t('debug.justNow');
    if (diff < 3600000) return t('debug.minAgo', { min: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('debug.hrAgo', { hr: Math.floor(diff / 3600000) });
    return t('debug.daysAgo', { days: Math.floor(diff / 86400000) });
  };

  return (
    <div className="w-44 border-r border-slate-200 flex flex-col bg-slate-50">
      {/* New Chat 按钮 */}
      <button
        onClick={onNewChat}
        className="m-3 flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors"
      >
        <Plus size={16} /> {t('debug.newChat')}
      </button>

      {/* Chat 列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {chatList.length === 0 && (
          <p className="text-xs text-slate-400 text-center mt-4 px-2">
            {t('debug.noChats')}
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
              {chat.chat_title || t('debug.debugSession')}
            </div>
            <div className="text-slate-400 text-xs mt-1">
              {formatTimeAgo(chat.started_at)}
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${
              chat.resolved ? 'text-green-600' : 'text-orange-500'
            }`}>
              {chat.resolved ? (
                <><CheckCircle size={10} /> {t('debug.resolved')}</>
              ) : (
                <><Circle size={10} className="fill-current" /> {t('debug.active')}</>
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

function ExecutionUI({ payload, onGoGenerate, t }) {
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
        {payload.type === 'prompt_fix' && t('debug.promptFixInstructions')}
        {payload.type === 'code_fix' && t('debug.codeFixInstructions')}
        {payload.type === 'reset' && t('debug.resetInstructions')}
      </p>
      <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-sm mb-3 whitespace-pre-wrap">
        {payload.fixText}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50 transition-colors"
        >
          {copied ? `✓ ${t('debug.copied')}` : `📋 ${t('common.copy')}`}
        </button>
        <button
          onClick={onGoGenerate}
          className={`px-4 py-2 text-white rounded-lg text-sm font-bold transition-colors ${colors.btn}`}
        >
          {t('debug.goGenerate')} →
        </button>
      </div>
    </div>
  );
}

// =====================================================
// 子组件：UpgradeSelector — Reset 时选择保留的功能
// =====================================================

function UpgradeSelector({ upgrades, selected, onSelect, onConfirm, t }) {
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mt-2">
      <p className="text-sm font-bold text-purple-800 mb-3">{t('debug.selectFeatures')}</p>
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
        {t('debug.continueBtn')} →
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
  t,
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
          <p className="text-sm">{t('debug.clickToStart')}</p>
        </div>
      </div>
    );
  }

  // 过滤掉内部系统消息（路由标记等），只显示给学生的消息
  const visibleMessages = messages.filter(msg => {
    // 过滤掉路由标记
    if (msg.content?.includes('[ROUTED-TO-')) return false;
    // 过滤掉其他工具结果标记
    if (msg.isToolResult) return false;
    // 过滤掉其他内部标记
    if (msg.content?.includes('[ORCHESTRATOR-SUMMARY]')) return false;
    if (msg.content?.includes('[CHAT-INSIGHT]')) return false;
    if (msg.content?.includes('[SWITCH-TO-DEBUG]')) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleMessages.map((msg, i) => (
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
          <ExecutionUI payload={executionPayload} onGoGenerate={onGoGenerate} t={t} />
        )}

        {/* Reset 时的 Upgrade 选择器 */}
        {showUpgradeSelector && (
          <UpgradeSelector
            upgrades={successfulUpgrades}
            selected={selectedUpgrades}
            onSelect={onSelectUpgrades}
            onConfirm={onConfirmUpgrades}
            t={t}
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
            placeholder={pendingImage ? t('debug.describeWithImage') : t('debug.describeIssue')}
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
  // i18n: 获取当前语言和翻译函数
  const { language } = useLanguage();
  const t = useT();

  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bugSummary, setBugSummary] = useState('');
  const [executionPayload, setExecutionPayload] = useState(null);

  // 方案 B: 统一 Debug Agent，单一 RoundCounter
  const roundCounter = useRef(new RoundCounter());

  // Reset 状态（方案 B 简化）
  const [showUpgradeSelector, setShowUpgradeSelector] = useState(false);
  const [selectedUpgrades, setSelectedUpgrades] = useState([]);
  const [successfulUpgrades, setSuccessfulUpgrades] = useState([]);

  // Image upload state
  const [pendingImage, setPendingImage] = useState(null);
  const imageInputRef = useRef(null);

  // P7: Resolution/Iteration/Recovery state
  const [awaitingResolution, setAwaitingResolution] = useState(false);

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
      .select('conversation_history, resolved, bug_description')
      .eq('id', chatId)
      .single();

    if (data) {
      setMessages(data.conversation_history || []);
      setBugSummary(data.bug_description || '');
      setExecutionPayload(null);
      setShowUpgradeSelector(false);
      setAwaitingResolution(false);

      // 方案 B: 从对话历史计算 round
      const userMessages = (data.conversation_history || []).filter(m => m.role === 'user');
      roundCounter.current = new RoundCounter();
      for (let i = 0; i < userMessages.length; i++) {
        roundCounter.current.increment();
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

    // 调试日志：显示将要保存的数据
    console.log('[updateChatHistory] Saving', dbMessages.length, 'messages, size:', JSON.stringify(dbMessages).length, 'bytes');

    const { error } = await supabase.from('debug_sessions').update({
      conversation_history: dbMessages,
    }).eq('id', chatId);

    if (error) {
      // 详细错误日志，帮助诊断 400 Bad Request
      console.error('[updateChatHistory] Supabase error:', JSON.stringify(error));
      console.error('[updateChatHistory] Failed data sample:', JSON.stringify(dbMessages[0]));
      console.error('[updateChatHistory] Total messages:', dbMessages.length);
      console.error('[updateChatHistory] Data size:', JSON.stringify(dbMessages).length, 'bytes');

      // 如果还是失败，尝试最小化保存
      if (error.code === 'PGRST204' || error.message?.includes('too large')) {
        const minimal = dbMessages.slice(-10).map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content.slice(0, 200) : '[non-string]',
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

  // 方案 B: 统一 Debug Agent prompt
  const buildSystemPrompt = async () => {
    const timeline = await getTimeline(studentId, sessionId);
    const contextString = formatForDebug(timeline, currentPrompt);

    // 如果需要 reset，获取成功的 Upgrade 列表
    if (showUpgradeSelector) {
      const upgrades = getSuccessfulUpgradesFromTimeline(timeline);
      setSuccessfulUpgrades(upgrades);
      return buildResetConfirmPrompt(contextString, upgrades, language);
    }

    return buildUnifiedDebugPrompt(contextString, currentPrompt, roundCounter.current.get(), language);
  };

  // =====================================================
  // Image handling
  // =====================================================

  const handleImageSelect = (file) => {
    if (file.size > 2 * 1024 * 1024) {
      alert(t('debug.imageTooLarge'));
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert(t('debug.pleaseSelectImage'));
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

  // 方案 B: 简化的 New Chat
  const handleNewChat = async () => {
    const { data: newChat, error } = await supabase
      .from('debug_sessions')
      .insert({
        student_id: studentId,
        session_id: sessionId,
        bug_type: 'pending',
        conversation_history: [],
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create debug session:', error);
      return;
    }

    // 重置状态
    setActiveChatId(newChat.id);
    setMessages([]);
    setBugSummary('');
    setExecutionPayload(null);
    setShowUpgradeSelector(false);
    setSelectedUpgrades([]);
    setAwaitingResolution(false);
    roundCounter.current.reset();

    setIsLoading(true);

    try {
      // 方案 B: 使用统一 prompt 获取欢迎消息
      const systemPrompt = await buildSystemPrompt();
      const response = await callAgentDirect({
        systemPrompt,
        messages: [],
        maxTokens: 500,
      });

      const initialMessage = {
        role: 'assistant',
        content: response.response || t('debug.fallbackGreeting'),
        timestamp: new Date().toISOString(),
      };
      setMessages([initialMessage]);
      await updateChatHistory(newChat.id, [initialMessage]);
    } catch (error) {
      console.error('Failed to start debug chat:', error);
      setMessages([{
        role: 'assistant',
        content: t('debug.fallbackGreeting'),
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      await loadChatList();
    }
  };

  // Q状态更新已移除 - 简化版 Orchestrator 一轮判断

  // 方案 B: 统一 Debug Agent handleSend
  const handleSend = async () => {
    if ((!inputText.trim() && !pendingImage) || isLoading || !activeChatId) return;

    const hasImage = !!pendingImage;
    const textContent = inputText.trim() || (hasImage ? 'Please analyze this screenshot.' : '');

    // P7: Check for iteration/recovery prompt response first
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.isIterationPrompt && !hasImage) {
      await handleIterationResponse(textContent);
      return;
    }
    if (lastMessage?.isRecoveryPrompt && !hasImage) {
      await handleRecoveryResponse(textContent, lastMessage.recoveryHint);
      return;
    }

    // P7: Handle resolution judgment when awaiting
    if (awaitingResolution && !hasImage) {
      setIsLoading(true);

      const userMessage = {
        role: 'user',
        content: textContent,
        timestamp: new Date().toISOString(),
      };
      const messagesWithUser = [...messages, userMessage];
      setMessages(messagesWithUser);
      setInputText('');

      try {
        const isResetScenario = executionPayload?.type === 'reset';
        const keptCount = selectedUpgrades?.length || 0;
        const previousCount = successfulUpgrades?.length || 0;

        const systemPrompt = buildResolutionJudgePrompt(
          isResetScenario, keptCount, previousCount, language
        );

        const response = await callAgentDirect({
          systemPrompt,
          messages: [{ role: 'user', content: textContent }],
          maxTokens: 200,
        });

        const agentMessage = {
          role: 'assistant',
          content: response.response,
          timestamp: new Date().toISOString(),
          isIterationPrompt: response.isIterationPrompt || false,
          isRecoveryPrompt: response.isRecoveryPrompt || false,
        };

        const finalMessages = [...messagesWithUser, agentMessage];
        setMessages(finalMessages);
        await updateChatHistory(activeChatId, finalMessages);

        if (response.resolved === true) {
          await supabase.from('debug_sessions').update({
            resolved: true,
            resolved_at: new Date().toISOString(),
          }).eq('id', activeChatId);
          setAwaitingResolution(false);
          await loadChatList();
        } else if (response.resolved === false) {
          setAwaitingResolution(false);
        }
      } catch (error) {
        console.error('[DebugChat] Resolution judge error:', error);
        setAwaitingResolution(false);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    console.log('[DebugChat] handleSend (Unified Agent):', {
      round: roundCounter.current.get(),
      inputText: textContent,
      hasImage,
    });

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
          systemPrompt: 'You are a helpful game debugging assistant. Analyze the screenshot and help identify issues. Return JSON: {"response": "your message", "fix_type": "none", "resolved": false, "continue": true}',
          messages: messagesForApi,
          maxTokens: 800,
          hasImage: true,
        });
      } else {
        // 方案 B: 使用统一 Debug Agent
        const systemPrompt = await buildSystemPrompt();
        const currentRound = roundCounter.current.get();

        console.log('[DebugChat] Calling unified agent, round:', currentRound);

        response = await callAgent({
          mode: 'debug_unified',
          userInput: textContent,
          currentRound,
          systemPrompt,
          conversationHistory: updatedMessages,
          maxTokens: 800,
        });
      }

      // 处理 fix_type 响应
      const fixType = response.fix_type;
      console.log('[DebugChat] Response fix_type:', fixType);

      // 如果是 reset，显示 Upgrade 选择器
      if (fixType === 'reset' && !showUpgradeSelector) {
        const timeline = await getTimeline(studentId, sessionId);
        const upgrades = getSuccessfulUpgradesFromTimeline(timeline);
        setSuccessfulUpgrades(upgrades);
        if (upgrades.length > 0) {
          setShowUpgradeSelector(true);
        }
      }

      // 如果有 fix_text，设置执行 payload
      if (fixType && fixType !== 'none' && response.fix_text) {
        const payload = {
          type: fixType === 'prompt_add' || fixType === 'prompt_replace' ? 'prompt_fix' :
                fixType === 'code_fix' ? 'code_fix' : 'reset',
          fixText: response.fix_text,
        };
        console.log('[DebugChat] Execution payload:', payload);
        setExecutionPayload(payload);
      }

      // 如果 resolved，更新数据库
      if (response.resolved === true) {
        await supabase.from('debug_sessions').update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          bug_description: response.bug_summary,
        }).eq('id', activeChatId);
        await loadChatList();
      }

      // 更新 bug_summary
      if (response.bug_summary) {
        setBugSummary(response.bug_summary);
        await supabase.from('debug_sessions').update({
          bug_description: response.bug_summary,
        }).eq('id', activeChatId);
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

      // 更新 round
      if (response.continue !== false) {
        roundCounter.current.increment();
        console.log('[DebugChat] Round incremented to:', roundCounter.current.get());
      }

      // 自动生成 chat 标题
      if (updatedMessages.filter(m => m.role === 'user').length === 1) {
        await generateChatTitle(activeChatId, userMessage.content);
      }

    } catch (error) {
      console.error('Debug agent error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('debug.somethingWrong'),
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 方案 B: handleRoute 已移除，统一 Agent 直接处理

  // 方案 B: 简化的 handleGoGenerate
  const handleGoGenerate = async () => {
    if (executionPayload?.fixText) {
      // 写入时间线
      try {
        const fixType = executionPayload.type.replace('_fix', '');
        await writeDebugComplete(studentId, sessionId, fixType, executionPayload.fixText, false, lessonType);
      } catch (e) {
        console.log('[DebugChat] Timeline write skipped');
      }
    }

    // 设置 pendingVerification
    setPendingVerification({
      type: executionPayload?.type?.replace('_fix', '') || 'prompt',
      debugSessionId: activeChatId,
    });

    // 在对话里显示提示
    const goMessage = {
      role: 'assistant',
      content: t('debug.goToClaude'),
      timestamp: new Date().toISOString(),
    };
    const finalMessages = [...messages, goMessage];
    setMessages(finalMessages);
    await updateChatHistory(activeChatId, finalMessages);

    setExecutionPayload(null);
  };

  // 方案 B: 简化的 handleConfirmUpgrades
  const handleConfirmUpgrades = async () => {
    setShowUpgradeSelector(false);

    const selectionMessage = selectedUpgrades.length > 0
      ? `I want to keep: ${selectedUpgrades.join(', ')}`
      : 'I want to start completely fresh';

    // 直接发送选择消息
    const userMessage = {
      role: 'user',
      content: selectionMessage,
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    await updateChatHistory(activeChatId, updatedMessages);

    // 调用统一 Agent 生成新的 prompt
    setIsLoading(true);
    try {
      const systemPrompt = await buildSystemPrompt();
      const response = await callAgent({
        mode: 'debug_unified',
        userInput: selectionMessage,
        currentRound: roundCounter.current.get(),
        systemPrompt,
        conversationHistory: updatedMessages,
        maxTokens: 1000,
      });

      // 如果有新的 fix_text（重建的 prompt）
      if (response.fix_text) {
        setExecutionPayload({
          type: 'reset',
          fixText: response.fix_text,
        });
      }

      const assistantMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await updateChatHistory(activeChatId, finalMessages);

      roundCounter.current.increment();
    } catch (error) {
      console.error('[DebugChat] Reset confirmation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationReturn = async () => {
    const verifyMessage = {
      role: 'assistant',
      content: executionPayload?.type === 'reset'
        ? t('debug.welcomeBackReset')
        : t('debug.welcomeBack'),
      timestamp: new Date().toISOString(),
      isVerificationAsk: true,  // Mark for resolution tracking
    };

    const finalMessages = [...messages, verifyMessage];
    setMessages(finalMessages);
    await updateChatHistory(activeChatId, finalMessages);

    // P7: Set awaiting resolution state
    setAwaitingResolution(true);
    setPendingVerification(null);
  };

  // =====================================================
  // P7: Iteration/Recovery handlers
  // =====================================================

  const handleIterationResponse = async (idea) => {
    // Save iteration idea to timeline
    await writeEvent(studentId, sessionId, {
      type: 'iteration_idea',
      role: 'student',
      content: idea,
      metadata: {
        debug_session_id: activeChatId,
        triggered_by: 'post_debug_iteration',
      },
    });

    // Show closing message
    const userMsg = {
      role: 'user',
      content: idea,
      timestamp: new Date().toISOString(),
    };
    const closeMsg = {
      role: 'assistant',
      content: t('debug.iterationResponse', { idea: idea.slice(0, 50) }),
      timestamp: new Date().toISOString(),
    };

    const finalMessages = [...messages, userMsg, closeMsg];
    setMessages(finalMessages);
    await updateChatHistory(activeChatId, finalMessages);
    setInputText('');
  };

  const handleRecoveryResponse = async (insight, recoveryHint) => {
    // Check for "don't know" responses
    const isDontKnow = /don't know|不知道|no idea|idk|没想法|dunno/i.test(insight);

    if (isDontKnow && recoveryHint) {
      // Give hint and ask again
      const userMsg = {
        role: 'user',
        content: insight,
        timestamp: new Date().toISOString(),
      };
      const hintMsg = {
        role: 'assistant',
        content: recoveryHint,
        timestamp: new Date().toISOString(),
        isRecoveryPrompt: true,  // Keep the flag but remove hint for next round
      };

      const finalMessages = [...messages, userMsg, hintMsg];
      setMessages(finalMessages);
      await updateChatHistory(activeChatId, finalMessages);
      setInputText('');
      return;
    }

    // Save recovery insight to timeline
    await writeEvent(studentId, sessionId, {
      type: 'recovery_insight',
      role: 'student',
      content: insight,
      metadata: {
        debug_session_id: activeChatId,
        kept_count: selectedUpgrades?.length || 0,
        total_count: successfulUpgrades?.length || 0,
      },
    });

    // Show closing message
    const userMsg = {
      role: 'user',
      content: insight,
      timestamp: new Date().toISOString(),
    };
    const closeMsg = {
      role: 'assistant',
      content: t('debug.recoveryResponse'),
      timestamp: new Date().toISOString(),
    };

    const finalMessages = [...messages, userMsg, closeMsg];
    setMessages(finalMessages);
    await updateChatHistory(activeChatId, finalMessages);
    setInputText('');
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
        t={t}
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
        t={t}
      />
    </div>
  );
}
