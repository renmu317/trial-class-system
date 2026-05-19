-- P3 Agentic AI Schema
-- Run this in Supabase SQL Editor
-- Prerequisites: sessions and students tables must exist

-- =====================================================
-- 1. conversion_signals 表（独立于 student_signals）
-- =====================================================
create table if not exists conversion_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade unique,

  -- TA 写入（同步销售端）
  pa_stayed bool default false,           -- 家长全程陪同
  pa_photo bool default false,            -- 家长拍照/录像
  pa_asked_price bool default false,      -- 家长询问价格 ⚠️ 触发销售提醒
  pa_leaned_in bool default false,        -- 家长探头看屏幕
  pa_surprised bool default false,        -- 家长表现惊喜
  ch_showed_parent bool default false,    -- 孩子主动展示给家长 ⚠️ 触发销售提醒
  ch_wants_continue bool default false,   -- 孩子说想继续学 ⚠️ 触发销售提醒
  ch_explained_parent bool default false, -- 孩子给家长解释作品

  -- 销售写入
  sale_qr_shown bool default false,       -- 已展示付款二维码
  sale_deposit_taken bool default false,  -- 已收定金
  sale_intent_tier text check (sale_intent_tier in ('Hot','Warm','Cold')),
  sale_notes text,

  -- 系统自动（网页埋点）
  rep_opened bool default false,          -- 报告已打开
  rep_read_depth bool default false,      -- 阅读深度 >50%
  rep_cta_clicked bool default false,     -- CTA 按钮已点击
  rep_shared bool default false,          -- 报告已分享

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 索引
create index if not exists idx_conversion_signals_student on conversion_signals(student_id);
create index if not exists idx_conversion_signals_session on conversion_signals(session_id);

-- RLS（MVP: anon 全开放，后续加 role 限制）
alter table conversion_signals enable row level security;

drop policy if exists "anon_conversion_select" on conversion_signals;
drop policy if exists "anon_conversion_insert" on conversion_signals;
drop policy if exists "anon_conversion_update" on conversion_signals;
drop policy if exists "anon_conversion_delete" on conversion_signals;

create policy "anon_conversion_select" on conversion_signals for select using (true);
create policy "anon_conversion_insert" on conversion_signals for insert with check (true);
create policy "anon_conversion_update" on conversion_signals for update using (true) with check (true);
create policy "anon_conversion_delete" on conversion_signals for delete using (true);

-- 开启 Realtime
alter publication supabase_realtime add table conversion_signals;

-- =====================================================
-- 2. reports 表
-- =====================================================
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,

  content_zh text,                        -- 中文报告内容
  content_en text,                        -- 英文报告内容
  pathway_zh text,                        -- 中文学习路径
  pathway_en text,                        -- 英文学习路径
  cta_tier text check (cta_tier in ('enrolled','hot','warm','cold')),

  share_token uuid unique default gen_random_uuid(),

  -- 折扣窗口（在应用层计算，基于 created_at）
  -- discount_tier 将在查询时通过 SQL 或应用代码计算

  sent_at timestamptz,                    -- 报告发送时间
  created_at timestamptz default now()
);

-- 索引
create index if not exists idx_reports_student on reports(student_id);
create index if not exists idx_reports_token on reports(share_token);

-- RLS
alter table reports enable row level security;

drop policy if exists "anon_reports_select" on reports;
drop policy if exists "anon_reports_insert" on reports;
drop policy if exists "anon_reports_update" on reports;
drop policy if exists "anon_reports_delete" on reports;

create policy "anon_reports_select" on reports for select using (true);
create policy "anon_reports_insert" on reports for insert with check (true);
create policy "anon_reports_update" on reports for update using (true) with check (true);
create policy "anon_reports_delete" on reports for delete using (true);

-- =====================================================
-- 3. 更新触发器（自动更新 updated_at）
-- =====================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_conversion_signals_updated_at on conversion_signals;
create trigger update_conversion_signals_updated_at
  before update on conversion_signals
  for each row
  execute function update_updated_at_column();

-- =====================================================
-- 验证
-- =====================================================
-- 运行以下命令验证表创建成功：
-- select * from conversion_signals limit 1;
-- select * from reports limit 1;
