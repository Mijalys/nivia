// Migraciones en orden. Cada una corre una sola vez y queda registrada en schema_migrations.
// El aislamiento por cliente lo hace PostgreSQL con Row Level Security (RLS): la app
// trabaja con el rol nivia_app y fija app.tenant_id en cada transacción.

const TENANT_TABLES = [
  'app_user', 'credential', 'otp_challenge', 'device_session',
  'route', 'route_version', 'level', 'lesson', 'lesson_asset', 'question',
  'assignment', 'progress_event', 'lesson_progress', 'quiz_result',
  'exam_attempt', 'attempt_answer', 'certificate', 'content_report', 'audit_log', 'outbox'
];

const rls = TENANT_TABLES.map((t) => `
alter table ${t} enable row level security;
alter table ${t} force row level security;
create policy tenant_isolation on ${t}
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
grant select, insert, update, delete on ${t} to nivia_app;`).join('\n');

export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'nivia_app') then
    create role nivia_app nologin;
  end if;
end $$;
do $$ begin
  execute format('grant nivia_app to %I', current_user);
exception when others then null;
end $$;

create table tenant (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  mono text not null,
  branding jsonb not null,
  exam_policy jsonb not null,
  cert_prefix text not null,
  cert_validity_months int not null default 12,
  created_at timestamptz not null default now()
);
grant select on tenant to nivia_app;

create table app_user (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  first_name text not null,
  last_name text not null,
  phone text not null,
  area text,
  created_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table credential (
  user_id uuid primary key references app_user(id),
  tenant_id uuid not null references tenant(id),
  password_hash text not null,
  is_temporary boolean not null default false,
  updated_at timestamptz not null default now()
);

create table otp_challenge (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  user_id uuid not null references app_user(id),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts_left int not null default 3,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table device_session (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  user_id uuid not null references app_user(id),
  refresh_hash text not null,
  device_label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table route (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  slug text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table route_version (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  route_id uuid not null references route(id),
  version int not null,
  status text not null check (status in ('draft', 'published', 'retired')),
  title text not null,
  overline text not null,
  published_at timestamptz,
  unique (route_id, version)
);

create table level (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  route_version_id uuid not null references route_version(id),
  position int not null,
  title text not null,
  unique (route_version_id, position)
);

create table lesson (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  route_version_id uuid not null references route_version(id),
  level_id uuid not null references level(id),
  position int not null,
  title text not null,
  format text not null check (format in ('presenter', 'animated')),
  duration_s int not null,
  summary jsonb not null,
  ai_generated boolean not null default true,
  unique (route_version_id, position)
);

create table lesson_asset (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  lesson_id uuid not null references lesson(id),
  kind text not null check (kind in ('hls', 'mp4_offline', 'captions', 'poster')),
  storage_key text not null,
  size_bytes int not null,
  unique (lesson_id, kind)
);

create table question (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  lesson_id uuid not null references lesson(id),
  position int not null,
  prompt text not null,
  options jsonb not null,
  correct_index int not null,
  why text not null,
  video_t int not null default 0,
  source_refs jsonb not null default '[]',
  in_quiz boolean not null default true,
  in_exam boolean not null default true
);

create table assignment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  user_id uuid not null references app_user(id),
  route_version_id uuid not null references route_version(id),
  kind text not null default 'initial' check (kind in ('initial', 'renewal')),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  assigned_at timestamptz not null default now(),
  due_at timestamptz not null,
  completed_at timestamptz
);
create index assignment_user_idx on assignment (user_id, status);

create table progress_event (
  event_id uuid primary key,
  tenant_id uuid not null references tenant(id),
  user_id uuid not null references app_user(id),
  device_session_id uuid,
  type text not null,
  lesson_id uuid,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  status text not null check (status in ('accepted', 'rejected')),
  reason text
);

create table lesson_progress (
  tenant_id uuid not null references tenant(id),
  assignment_id uuid not null references assignment(id),
  lesson_id uuid not null references lesson(id),
  video_position_s int not null default 0,
  watched boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, lesson_id)
);

create table quiz_result (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  assignment_id uuid not null references assignment(id),
  lesson_id uuid not null references lesson(id),
  event_id uuid not null,
  answers jsonb not null,
  correct int not null,
  total int not null,
  occurred_at timestamptz not null
);

create table exam_attempt (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  assignment_id uuid not null references assignment(id),
  user_id uuid not null references app_user(id),
  number int not null,
  question_ids jsonb not null,
  time_limit_s int not null,
  time_used_s double precision not null default 0,
  paused_s double precision not null default 0,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  score int,
  passed boolean,
  weak_lesson_ids jsonb,
  finished_at timestamptz,
  unique (assignment_id, number)
);

create table attempt_answer (
  tenant_id uuid not null references tenant(id),
  attempt_id uuid not null references exam_attempt(id),
  question_id uuid not null references question(id),
  choice int not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table certificate (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  user_id uuid not null references app_user(id),
  assignment_id uuid references assignment(id),
  route_title text not null,
  score int not null,
  code text not null unique,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'valid' check (status in ('valid', 'revoked'))
);

create table content_report (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  user_id uuid not null references app_user(id),
  lesson_id uuid not null references lesson(id),
  question_id uuid references question(id),
  reason text not null check (reason in ('confusing_question', 'content_error', 'video_unclear')),
  comment text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  actor_user_id uuid,
  action text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id),
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

${rls}
`
  }
];
