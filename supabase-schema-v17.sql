-- V17 五维度信号采集表
-- 执行此 SQL 在 Supabase Dashboard > SQL Editor

-- 新的 student_signals 表（替代 scores 表的评分逻辑）
create table student_signals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade unique,

  -- Competence Loop (系统自动)
  cl_game_made boolean default false,
  cl_game_played boolean default false,
  cl_game_modified boolean default false,

  -- Ownership (混合)
  ow_named boolean default false,
  ow_custom_name text,
  ow_showed boolean default false,        -- TA手动
  ow_explained boolean default false,     -- TA手动

  -- Persistence (系统自动)
  ps_got_stuck boolean default false,
  ps_recovered boolean default false,
  ps_asked_help boolean default false,

  -- Challenge Seed (混合)
  cs_used_hard boolean default false,
  cs_used_medium boolean default false,
  cs_own_idea boolean default false,
  cs_verbal_want boolean default false,   -- TA手动
  cs_kept_working boolean default false,

  -- Parent Signal (TA手动)
  pr_took_photo boolean default false,
  pr_asked_price boolean default false,
  pr_stayed_long boolean default false,
  pr_looked_screen boolean default false,

  -- 元数据
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 索引
create index idx_signals_student on student_signals(student_id);

-- RLS
alter table student_signals enable row level security;
create policy "anon_signals" on student_signals for all using (true) with check (true);
