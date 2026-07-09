# P5 架构整改与上线加固计划

## 1. 目标

当前 Trial Class System 已覆盖学生课堂创作、TA 观察和报告、销售跟进及 Agent 学习记录。仓库当前已经加入了 TA Supabase Auth、机构隔离和 enrollment/shortcode 学生入口；P5 不再从零建立 Auth，而是完成这套 Auth 体系的收敛、加固和数据契约修复：

- 建立学生、员工和公开报告访问的明确身份边界。
- 将 DeepSeek 调用统一迁移到服务端，避免密钥暴露和无限制调用。
- 修复报告埋点、销售提醒和折扣展示的数据契约不一致。
- 将 `session_timeline` 建成课堂学习过程的统一事件来源。
- 使跨课时学生画像真正可以聚合。
- 将零散 SQL 整理为可重复执行、可验证的迁移链路。

## 2. 当前实现基线

截至当前代码状态，已存在以下 Auth/Enrollment 能力：

- TA Dashboard 已接入 Supabase Auth：`Login.jsx`、`AuthCallback.jsx`、`SetPassword.jsx`、`AuthGuard.jsx`。
- TA 端已有 `organizations`、`ta_profiles`、`enrollment_batches`、`student_enrollments` 设计，见 `ta-auth-schema.sql`。
- TA session 创建已写入 `organization_id`，Setup/Dashboard 按 TA 机构读取。
- Enrollment 管理页已存在，可上传 CSV 并生成 enrollment links。
- Student App 已新增 `/enroll/:token` 报名页。
- Student App 首页已新增 `StudentLogin`，支持 6 位 student shortcode + 4 位 session code。
- 新增 Edge Functions：
  - `process-enrollment-csv`
  - `verify-enrollment-token`
  - `complete-enrollment`
  - `verify-shortcode`
  - `join-session`
  - `set-user-password`

需要注意：这些能力已经进入代码，但仍处于过渡态。试课匿名建课是产品允许的轻量入口，但需要限定用途；直接表读写和旧 schema 文件仍同时存在。

## 3. 当前问题与决策

| 问题 | 当前状态 | P5 决策 |
|------|----------|---------|
| RLS 权限 | TA Auth 已建立；试课允许匿名建 session，但大量前端直连表读写仍存在 | 保留受控匿名建课；其他公开访问收敛到 Edge Function/RPC 返回的最小数据 |
| AI 密钥 | Student 走 Edge Function；TA Report 仍暴露 `VITE_DEEPSEEK_API_KEY` | 所有 AI 请求统一由 Edge Function 代理 |
| 学生长期身份 | 已有 `student_enrollments` + shortcode，但还不是正式 learner 模型 | 短期以 `student_enrollments` 作为身份来源；长期再引入 `learners` 或将其演进为 learner |
| 报告埋点 | schema/组件在 `reports` 与 `conversion_signals` 之间不一致 | 报告行为统一写入 `report_events`，状态由 view 聚合 |
| Agent 时间线 | `session_timeline` 与 `agent_sessions`/`debug_sessions` 并存且接入不完整 | timeline 为事实事件流，流程表保留为可查询快照 |
| Schema 管理 | 多个手工 SQL 文件，且 Auth schema 与当前函数存在字段漂移 | 引入 `supabase/migrations/` 顺序迁移与 smoke test |

## 4. 目标架构

```text
Public Website
    |
    +-- Student App -------- authenticated anonymous enrollment token
    +-- Parent Report ------ single report access token
    +-- TA Dashboard ------- authenticated staff role: ta/admin
    +-- Sales App ---------- internal/controlled operator surface
                         |
                  Supabase Boundary
      Auth + RLS + RPC / Edge Functions + Realtime
                         |
       Canonical relational state + append-only events
                         |
        reports / signal views / summaries / profiles
                         |
             DeepSeek through Edge Functions only
```

## 5. 数据模型调整

### 5.1 身份与课堂参与

当前短期身份来源应先统一为 `student_enrollments`，避免使用每次课堂的 `students.id` 聚合长期数据。后续如果需要家长账号、多孩子绑定或跨机构合并，再新增 `learners`。

```sql
alter table student_enrollments
  add column if not exists shortcode text unique;

alter table students
  add column if not exists enrollment_id uuid references student_enrollments(id),
  add column if not exists organization_id uuid references organizations(id);
```

迁移策略：

1. 先修正 `ta-auth-schema.sql`：`shortcode` 应存在于 `student_enrollments`，不应只存在于 `students`。
2. `join-session` 创建的 `students` 记录必须带 `enrollment_id` 和 `organization_id`。
3. 旧匿名姓名入口保留为 fallback，但所有新入口默认走 `join-session`。
4. `session_summaries` 先增加 `enrollment_id`，使多节课可按报名身份聚合。
5. 若后续需要更强身份模型，再从 `student_enrollments` 迁移/抽象出 `learners`。

### 5.2 员工角色

```sql
-- 当前已采用 ta_profiles
-- role: ta | org_admin | super_admin
```

权限规则：

| 能力 | Student | Parent Token | TA | Sales | Admin |
|------|---------|--------------|----|-------|-------|
| 读取自己的课堂状态 | Yes | No | Yes | No | Yes |
| 写自己的学习事件 | Yes | No | No | No | Yes |
| 管理 session | No | No | Yes | No | Yes |
| 写教学信号/报告 | No | No | Yes | No | Yes |
| 写销售状态 | No | No | No | Sales/Org Admin | Super Admin |
| 读取公开报告 | No | Token 限定一份 | Yes | Yes | Yes |

### 5.3 报告行为事件

不再把报告行为布尔值分别混在 `conversion_signals` 或 `reports`。

```sql
create table report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  event_type text not null check (
    event_type in ('opened', 'read_depth', 'cta_clicked', 'shared')
  ),
  occurred_at timestamptz default now(),
  metadata jsonb default '{}'
);

create view report_engagement_status as
select
  report_id,
  bool_or(event_type = 'opened') as rep_opened,
  bool_or(event_type = 'read_depth') as rep_read_depth,
  bool_or(event_type = 'cta_clicked') as rep_cta_clicked,
  bool_or(event_type = 'shared') as rep_shared
from report_events
group by report_id;
```

折扣规则也由数据库 view 或单一共享函数给出，避免 Student 与 Sales 两端分别计算。

## 6. 权限与安全整改

### P5-A: 身份与 RLS 基线

**目的**：在已有 TA Auth/Enrollment 基础上，保留试课轻量入口，同时停止非必要匿名直连路径继续扩大。

改动文件：

- `ta-auth-schema.sql`
- `supabase/migrations/*_ta_auth_baseline.sql`
- `supabase/migrations/*_rls_lockdown.sql`
- `ta-dashboard/src/lib/supabase.js`
- `sales-app/src/lib/supabase.js`
- `student-app/src/App.jsx`
- `student-app/src/components/StudentLogin.jsx`

实施任务：

1. 修正 `ta-auth-schema.sql` 与函数契约：
   - `student_enrollments.shortcode` 必须存在。
   - `students.shortcode` 应移除或停止使用。
   - 补齐 `increment_enrolled_count(batch_id_param uuid)` RPC。
2. 保留 `sessions_anon_insert` 作为试课快速建课入口，但收紧写入字段、默认状态和过期策略，避免匿名用户写入销售、报告或组织敏感字段。
3. 将 Student App 的旧 `?code=` 路径也迁移到 `join-session`，不再前端直查 `sessions`/`students` 后创建学生。
4. 收紧 `students_anon_session`，匿名用户不应能枚举近 8 小时所有学生；只允许 Edge Function 写入/返回单个学生。
5. `AuthGuard` 不应绕过 Supabase client 直接用 anon REST 拉 `ta_profiles`；改用 `supabase.from('ta_profiles')` 或受控 RPC，并依赖 RLS。
6. 报告读取通过 `share_token` RPC 返回限定字段，不允许匿名查询整张 `reports` 表。
7. Sales App 暂不强制增加 AuthGuard；本阶段只收紧其依赖的数据读取面，避免通过 anon key 枚举 reports、students、conversion signals 等敏感表。
8. Realtime 只开放给相应角色可读取的表/行。

验收标准：

- 未登录浏览器只能创建一条符合试课规则的 session，不能列出 students、reports 或 conversion signals。
- 匿名创建的 session 字段受限、可过期，且不能写入组织、销售或报告权限相关字段。
- 4 位课堂码只能通过 `join-session` 返回当前学生自己的课堂信息。
- 6 位 student shortcode 只能恢复该学生身份，不能直接枚举 enrollment 表。
- TA 不能修改 `sale_*` 字段；Sales 不能修改学习记录。
- 已分享的报告链接仍可正常打开，但只返回该报告的展示字段。

### P5-B: AI 调用统一后端化

**目的**：保护 API key，并限制 AI 成本和输入风险。

改动文件：

- 扩展 `supabase/functions/deepseek-proxy/index.ts`
- 新增 `supabase/functions/generate-report/index.ts`
- 新增 `supabase/functions/generate-followup/index.ts`
- 修改 `ta-dashboard/src/components/ReportGenerator.jsx`
- 修改 `ta-dashboard/src/components/ReportReviewPanel.jsx`
- 修改 `ta-dashboard/src/lib/reportPrompt.js`

实施任务：

1. 移除 TA Dashboard 对 `VITE_DEEPSEEK_API_KEY` 的读取。
2. 报告和 follow-up 调用 Edge Functions；服务端读取学生数据并写回结果。
3. `deepseek-proxy` 验证课堂 enrollment token，只接受允许的 Agent mode。
4. `generate-report` 与 `generate-followup` 验证 `ta`/`admin` 身份。
5. 加入请求大小、最大 token、频率限制和基础审计日志。
6. 仅服务端决定 system prompt 和允许调用的模型，前端不传任意 system prompt。

验收标准：

- 生产 bundle 中不存在 DeepSeek key。
- 匿名用户无法直接调用 TA 报告生成功能。
- 短时间重复请求会被限制并返回明确错误。
- Agent、报告、跟进三条 AI 流程均有可查询调用日志。

## 7. 数据一致性整改

### P5-C: 报告与转化链路修复

**目的**：确保家长行为真实写入，并被 TA/Sales 看到。

改动文件：

- 新增 `supabase/migrations/*_report_events.sql`
- `student-app/src/pages/ReportPage.jsx`
- `ta-dashboard/src/components/ReportReviewPanel.jsx`
- `sales-app/src/App.jsx`
- `ta-dashboard/src/lib/reportPrompt.js`

实施任务：

1. 建立 `report_events` 和 `report_engagement_status`。
2. Public Report 页面通过受限 RPC 写入 `opened/read_depth/cta_clicked/shared`。
3. 修复首次加载时在 report state 建立前写埋点的问题。
4. TA Review 和 Sales 均读取同一个 engagement view。
5. 建立 `reports_with_offer` view，统一报告页与销售端的折扣窗口结果。
6. 迁移已存在的 `conversion_signals.rep_*` 数据到 `report_events`。

验收标准：

- 打开分享链接后，TA 页面可看到 `opened`。
- 滚动、CTA 和分享事件各自只产生需要的记录，重复打开可审计。
- Sales 的提醒来自数据库事件变化，而非前端推断字段漂移。
- 报告页和 Sales 显示完全相同的优惠金额与剩余期限。

### P5-D: 时间线成为统一学习事实流

**目的**：让摘要和画像基于完整、可审计的学习过程，而不是多个不一致快照。

改动文件：

- `student-app/src/lib/timeline.js`
- `student-app/src/App.jsx`
- `student-app/src/components/PromptGenerator.jsx`
- `student-app/src/components/AgentPanel.jsx`
- `student-app/src/components/DebugChat.jsx`
- `student-app/src/lib/AgentBridge.js`
- `supabase/functions/compress-session/index.ts`

实施任务：

1. 为下列事件接入实际写入调用：
   - `build_complete`
   - `prompt_generated`
   - `prompt_copied`
   - `gate1_round`
   - `gate1_complete`
   - `gate2_verify` 或明确的 `gate2_inferred`
   - `debug_message`
   - `debug_complete`
   - `game_regenerated`
2. 给 timeline 写入添加事件 schema 校验与幂等键。
3. `agent_sessions` 与 `debug_sessions` 继续保存 UI 查询需要的当前状态，但关键结论必须存在对应 timeline event。
4. 修改 `compress-session`，仅基于 timeline 聚合摘要，并记录压缩版本。
5. 明确 Gate 2 的 `inferred` 与 `verified` 不同语义，报告中不得将推断结果呈现为已验证能力。

验收标准：

- 完成一节测试课后可回放完整学生路径。
- 任一 Agent/Debug 状态变化均能找到对应 timeline event。
- 重复执行课堂压缩不会生成重复摘要。
- 报告摘要能够区分学生验证成功与系统推断成功。

### P5-E: 跨课时 learner 画像

**目的**：使多课时教学记录能围绕同一个学生持续累计。

改动文件：

- 新增 `supabase/migrations/*_learners_enrollments.sql`
- 新增 `supabase/migrations/*_profile_migration.sql`
- `student-app/src/App.jsx`
- `ta-dashboard/src/components/Setup.jsx` 或学员匹配界面
- `supabase/functions/compress-session/index.ts`

实施任务：

1. 新建 `learners` 和 `session_enrollments`。
2. TA 可在新场次中将 enrollment 绑定到已有 learner；未绑定时仅保留课堂级数据。
3. `session_summaries` 按 enrollment 产生，按 learner 聚合。
4. `student_profiles` 重建为 `learner_id` 主键。
5. 针对未绑定历史数据提供人工合并流程，不用名字自动合并。

验收标准：

- 同一 learner 参加三节课后生成一份合并画像。
- 同名不同学生不会被自动合并。
- 删除单场 enrollment 不误删 learner 的历史画像。

## 8. 工程治理

### P5-F: Schema 与质量门禁

改动文件：

- 新建 `supabase/migrations/`
- 新建 `scripts/schema-smoke-test.js`
- 新建根级 `package.json` 或统一验证脚本
- 更新 `README.md`

实施任务：

1. 将现有 schema 按依赖顺序整理为 baseline migration，再在其上新增 P5 migration。
2. 补齐当前应用已使用但基础迁移缺失的字段，例如 `sessions.join_code`、`student_enrollments.shortcode`、`increment_enrolled_count`。
3. 将文档中的目标 schema 与实际运行 schema 对齐。
4. 新增 smoke test 验证关键表、view、RLS policy 与 RPC 存在。
5. 清理当前 ESLint 错误，使 `build + lint` 成为提交门禁。
6. 为以下链路新增最小集成测试：
   - TA 创建课堂 -> Student 通过短码加入
   - Student Agent/Debug -> timeline 写入
   - TA 生成并分享报告 -> Parent 埋点 -> Sales 提醒
   - End Class -> summary/profile 生成

验收标准：

- 空数据库可从 migrations 一次构建到当前版本。
- CI 或本地统一脚本可执行三端 build、lint 和 schema smoke test。
- README 能准确说明三个应用、Edge Functions、迁移与环境变量。

## 9. 实施阶段与依赖

| 阶段 | 内容 | 前置依赖 | 预计工作量 |
|------|------|----------|------------|
| P5-0 | 修复 Auth schema 漂移、lint 基线、建立迁移目录和 schema 清单 | 无 | 1-2 天 |
| P5-1 | 报告埋点契约 + 优惠 view 修复 | P5-0 | 1-2 天 |
| P5-2 | 完成 TA Auth 与 RLS 收紧，保留受控试课匿名建课 | P5-0 | 3-5 天 |
| P5-3 | AI 调用全部迁移到 Edge Functions | P5-2 | 2-3 天 |
| P5-4 | Timeline 全链路写入与幂等压缩 | P5-0 | 3-4 天 |
| P5-5 | Enrollment 身份聚合与跨课时画像迁移 | P5-2, P5-4 | 3-5 天 |
| P5-6 | E2E 验证、文档更新和正式上线检查 | 全部 | 2-3 天 |

推荐执行顺序：

```text
P5-0 -> P5-1
     -> P5-2 -> P5-3
     -> P5-4 -> P5-5
所有阶段完成 -> P5-6
```

## 10. 迁移与上线策略

### 数据兼容原则

- 不直接删除当前业务字段或表。
- 先双写、再切读、最后停止 legacy 写入。
- 对 `reports`、`conversion_signals`、`agent_sessions` 保留回滚期。

### 发布批次

| 发布批次 | 内容 | 回滚方式 |
|----------|------|----------|
| Release 1 | migrations 基线、report events、优惠 view | 前端切回旧显示字段 |
| Release 2 | Auth 收敛、RLS、报告/销售数据读取受限权限 | 暂时恢复限定旧 policy |
| Release 3 | AI Edge Functions 全迁移 | 前端功能开关关闭 AI 操作 |
| Release 4 | timeline 双写与新版摘要 | 继续使用旧快照报告 |
| Release 5 | enrollment/profile 聚合切换 | 保留 `students` 读取链路 |

### 上线前检查清单

- [ ] 不存在生产前端 `VITE_DEEPSEEK_API_KEY`。
- [ ] anon key 只能创建受控试课 session，无法列出学生、报告和销售数据。
- [ ] TA 权限经过不同账户验证；Sales App 作为内部操作面单独做数据读取面验证。
- [ ] `ta-auth-schema.sql` 和所有 Edge Functions 使用的字段完全一致。
- [ ] 报告 token 只能获取目标报告的公开字段。
- [ ] 数据迁移可在 staging 数据副本执行并回滚。
- [ ] 三端 `npm run build` 和 `npm run lint` 通过。
- [ ] 核心 E2E 流程通过。
- [ ] 费用、AI 请求错误率和 Realtime 失败率有监控方式。

## 11. 暂不处理项

以下内容不是 P5 阻塞项，应在安全和数据一致性完成后另行排期：

- 新课程 Lesson 3 及以后内容建设。
- 更复杂的 Sales CRM 自动化。
- AI 自动发送家长报告或销售消息。
- 面向家长的正式账号体系。
- 正式 learner/family 账号体系；当前先用 `student_enrollments` 聚合。
- 高级画像可视化或预测转化评分。

## 12. 完成定义

P5 完成后，系统应满足：

1. 任何真实学生、家长和销售数据都有清晰可验证的访问边界。
2. 所有 AI 调用均在受控服务端执行，前端无敏感密钥。
3. 报告行为、销售提醒、优惠显示使用同一数据契约。
4. 一节课堂能够形成完整 timeline，并稳定生成摘要。
5. 同一 enrollment identity 跨课堂数据能够可靠汇聚为长期画像。
6. 新环境可依靠版本化 migrations 与验证脚本重建。
