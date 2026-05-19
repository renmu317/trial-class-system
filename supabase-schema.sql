-- Trial Class Data Collection System - Supabase Schema
-- 执行此 SQL 在 Supabase Dashboard > SQL Editor

-- sessions: trial class 场次
create table sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date timestamp with time zone default now(),
  status text default 'running' check (status in ('running','ended')),
  created_at timestamp with time zone default now()
);

-- students: 学生（每场课）
create table students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  name text not null,
  device_id text,
  game_name text,
  current_step text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone  -- 软删除字段
);

-- scores: 5维度评分（每个TA每个学生一条）
-- 注意：默认值为NULL，不是5，区分"未评分"和"评5分"
create table scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  ta_name text not null,
  ownership int check (ownership between 1 and 10),
  persistence int check (persistence between 1 and 10),
  curiosity int check (curiosity between 1 and 10),
  expression int check (expression between 1 and 10),
  parent_signal int check (parent_signal between 1 and 10),
  notes text,
  updated_at timestamp with time zone default now(),
  unique(student_id, ta_name)
);

-- student_events: 行为事件
create table student_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  event_type text not null,
  dimension text check (dimension in ('ownership','persistence','curiosity','expression','parent_signal')),
  data jsonb,
  created_at timestamp with time zone default now()
);

-- indexes
create index idx_students_session on students(session_id);
create index idx_scores_student on scores(student_id);
create index idx_events_student on student_events(student_id);
-- 复合索引优化 events 查询性能
create index idx_events_student_created on student_events(student_id, created_at desc);

-- RLS (MVP: anon全开放)
alter table sessions enable row level security;
alter table students enable row level security;
alter table scores enable row level security;
alter table student_events enable row level security;

create policy "anon_sessions" on sessions for all using (true) with check (true);
create policy "anon_students" on students for all using (true) with check (true);
create policy "anon_scores" on scores for all using (true) with check (true);
create policy "anon_events" on student_events for all using (true) with check (true);
