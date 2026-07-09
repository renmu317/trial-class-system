# Debug 图片上传功能实现计划

## 目标

在 DebugChat 中添加图片上传功能，让学生可以上传游戏截图，AI 直接分析图片来理解 bug。

## 技术方案

### Vision Model

使用 **DeepSeek V4 Vision** 模型：
- 兼容 OpenAI API 格式
- 支持 base64 图片输入
- 比 Claude/GPT-4o 便宜约 10 倍
- 模型需要确认：`deepseek-vl` 或 `deepseek-reasoner`（需测试 API）

参考：[DeepSeek V4 Vision](https://www.mindstudio.ai/blog/deepseek-v4-vision-cheaper-multimodal-ai-workflows)

### 图片输入格式（OpenAI 兼容）

```json
{
  "model": "deepseek-vl",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "分析这张游戏截图，学生说：the rock is stuck" },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
      ]
    }
  ]
}
```

---

## 文件修改清单

### 1. `supabase/functions/deepseek-proxy/index.ts`

**修改内容**：
- 接受可选的 `model` 参数（默认 `deepseek-chat`，图片时用 `deepseek-vl`）
- 支持 messages 中的多模态内容格式

```typescript
const { messages, temperature = 0.7, max_tokens = 1024, model = 'deepseek-chat' } = await req.json()

const requestBody = {
  model,  // 动态选择模型
  messages: enhancedMessages,
  temperature,
  max_tokens,
}
```

### 2. `student-app/src/components/DebugChat.jsx`

**新增 UI**：
- 在输入框旁添加 📷 图片上传按钮
- 图片预览区域（选中图片后显示缩略图 + ✕ 删除按钮）
- 图片大小限制（2MB）

**新增 State**：
```javascript
const [pendingImage, setPendingImage] = useState(null);  // { base64, type, preview }
const imageInputRef = useRef(null);
```

**新增函数**：
```javascript
// 处理图片选择
const handleImageSelect = (file) => {
  if (file.size > 2 * 1024 * 1024) {
    alert('Image too large. Max 2MB.');
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
```

**修改 `callDeepSeek`**：
```javascript
async function callDeepSeek(messages, temperature = 0.7, maxTokens = 800, hasImage = false) {
  const response = await fetch(DEEPSEEK_PROXY_URL, {
    body: JSON.stringify({
      messages: messagesWithConstraint,
      temperature,
      max_tokens: maxTokens,
      model: hasImage ? 'deepseek-vl' : 'deepseek-chat',  // 动态选择
    }),
  });
}
```

**修改 `handleSend`**：
```javascript
// 构建消息内容（支持图片）
let messageContent;
if (pendingImage) {
  messageContent = [
    { type: 'text', text: inputText.trim() || 'Please analyze this screenshot.' },
    { type: 'image_url', image_url: { url: pendingImage.base64 } }
  ];
} else {
  messageContent = inputText.trim();
}
```

---

## UI 设计

```
┌─────────────────────────────────────────────────────────┐
│  对话消息区域                                            │
│  ┌─────────────────────────────────────┐                │
│  │ [User message with screenshot]      │                │
│  │ ┌─────────────┐                     │                │
│  │ │   📷 Image  │                     │                │
│  │ └─────────────┘                     │                │
│  │ "the rock is stuck"                 │                │
│  └─────────────────────────────────────┘                │
│                                                         │
│  ┌─────────────────────────────────────┐                │
│  │ I can see the rock is inside the   │                │
│  │ wall. This looks like a collision  │                │
│  │ bug. Did you tell Claude about     │                │
│  │ collision detection?               │                │
│  └─────────────────────────────────────┘                │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────┐  (图片预览 - 选中后显示)              │
│  │  📷 ✕        │                                      │
│  └───────────────┘                                      │
├─────────────────────────────────────────────────────────┤
│  [📷] [________________________] [Send]                 │
│   ↑                                                     │
│   图片按钮                                               │
└─────────────────────────────────────────────────────────┘
```

---

## 实现步骤

### Phase 1: Edge Function 更新
1. 修改 `deepseek-proxy/index.ts` 支持动态 model 参数
2. 部署到 Supabase: `supabase functions deploy deepseek-proxy`

### Phase 2: DebugChat UI
1. 添加图片上传按钮（📷）和隐藏的 file input
2. 添加图片预览区域（在输入框上方）
3. 添加 pendingImage state + imageInputRef
4. 添加 handleImageSelect 和 handleRemoveImage 函数

### Phase 3: API 调用更新
1. 修改 callDeepSeek 接受 hasImage 参数
2. 修改 handleSend 构建多模态消息格式
3. 传递 hasImage 到 callDebugAgent

### Phase 4: 消息显示
1. 修改 ChatWindow 显示带图片的消息
2. 消息对象新增 hasImage 和 imagePreview 字段
3. 点击图片可放大查看

---

## 验证方式

1. **UI 测试**：
   - 点击 📷 按钮 → 文件选择器打开
   - 选择图片 → 预览显示在输入框上方
   - 点击 ✕ → 图片移除
   - 发送后 → 图片显示在对话中

2. **API 测试**：
   - 发送带图片的消息 → Console 显示 `model: 'deepseek-vl'`
   - AI 响应中提到图片内容 → 证明图片分析生效

3. **端到端测试**：
   - 上传一张显示 bug 的截图（如 rock stuck in wall）
   - AI 能描述看到的问题
   - 路由到正确的 Tool

---

## 风险和备选方案

### 风险 1: DeepSeek Vision API 不可用或 model ID 不正确
**解决**：
- 先测试 API，确认正确的 model ID
- 备选：使用 Claude Vision API（需要新的 API Key）

### 风险 2: 图片太大导致 API 超时
**解决**：
- 前端压缩图片（使用 canvas）
- 限制最大尺寸 1920x1080
- 限制文件大小 2MB

### 风险 3: Base64 图片导致 conversation_history 过大
**解决**：
- 只存储 `[Screenshot attached]` 标记到 DB
- imagePreview 只用于当前 session 的 UI 显示
- 不持久化存储图片内容

---

## 文件清单

| 文件 | 操作 |
|------|------|
| `supabase/functions/deepseek-proxy/index.ts` | 修改：支持动态 model 参数 |
| `student-app/src/components/DebugChat.jsx` | 修改：图片上传 UI + API 调用 |

---

## 创建日期

2026-05-25
