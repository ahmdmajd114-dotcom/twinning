-- Run this once in Supabase: SQL Editor > New query.
create table if not exists profiles (
  id bigint generated always as identity primary key,
  telegram_id bigint not null unique,
  real_name text not null,
  pseudonym text not null unique,
  gender text not null check (gender in ('female', 'male')),
  birth_year smallint not null check (birth_year between 1950 and 2010),
  city text not null,
  university text not null,
  major text not null,
  academic_year text not null,
  study_time text not null,
  learning_style text not null,
  goal text not null,
  consented_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the first launch. Existing students can complete these from the bot.
alter table profiles add column if not exists sessions_per_week smallint check (sessions_per_week between 1 and 7);
alter table profiles add column if not exists session_duration smallint check (session_duration in (30, 45, 60, 90, 120));
alter table profiles add column if not exists study_mode text check (study_mode in ('online', 'in_person', 'both'));
alter table profiles add column if not exists partner_preference text check (partner_preference in ('study', 'accountability', 'both'));
alter table profiles add column if not exists seriousness smallint check (seriousness between 1 and 5);
alter table profiles add column if not exists study_focus text;
alter table profiles add column if not exists previous_grades text;
alter table profiles add column if not exists preferences_notified_at timestamptz;
alter table profiles add column if not exists country text not null default 'العراق';
alter table profiles add column if not exists available_days text[];
alter table profiles add column if not exists available_slots text[];
alter table profiles add column if not exists availability_notified_at timestamptz;
alter table profiles add column if not exists call_preference text check (call_preference in ('call', 'no_call', 'both'));
alter table profiles add column if not exists aloud_reading_preference text check (aloud_reading_preference in ('prefer', 'okay', 'no'));
alter table profiles add column if not exists call_preferences_notified_at timestamptz;

-- Allow fixed choices plus a user-entered duration or study mode when needed.
alter table profiles drop constraint if exists profiles_session_duration_check;
alter table profiles add constraint profiles_session_duration_check check (session_duration is null or session_duration between 10 and 240);
alter table profiles drop constraint if exists profiles_study_mode_check;
alter table profiles add constraint profiles_study_mode_check check (study_mode is null or char_length(study_mode) between 1 and 80);

create table if not exists connections (
  id bigint generated always as identity primary key,
  requester_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  recipient_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_telegram_id, recipient_telegram_id),
  check (requester_telegram_id <> recipient_telegram_id)
);

create table if not exists ratings (
  id bigint generated always as identity primary key,
  connection_id bigint not null references connections(id) on delete cascade,
  reviewer_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  reviewed_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  commitment text not null check (commitment in ('committed', 'inconsistent', 'not_committed')),
  strengths text,
  improvements text,
  created_at timestamptz not null default now(),
  unique (connection_id, reviewer_telegram_id),
  check (reviewer_telegram_id <> reviewed_telegram_id)
);

-- Private, bot-mediated communication. Telegram usernames and real names are never exposed.
create table if not exists messages (
  id bigint generated always as identity primary key,
  connection_id bigint not null references connections(id) on delete cascade,
  sender_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  recipient_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Each party decides independently whether their real name is disclosed.
create table if not exists identity_disclosures (
  id bigint generated always as identity primary key,
  connection_id bigint not null references connections(id) on delete cascade,
  revealer_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  recipient_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (connection_id, revealer_telegram_id),
  check (revealer_telegram_id <> recipient_telegram_id)
);

create table if not exists study_tasks (
  id bigint generated always as identity primary key,
  connection_id bigint not null references connections(id) on delete cascade,
  creator_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 250),
  due_date date,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists study_sessions (
  id bigint generated always as identity primary key,
  connection_id bigint not null references connections(id) on delete cascade,
  starter_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);

-- Shared study room: invite, timed session, reflections and follow-up feedback.
alter table study_sessions add column if not exists recipient_telegram_id bigint references profiles(telegram_id) on delete cascade;
alter table study_sessions add column if not exists planned_minutes smallint check (planned_minutes in (25, 50));
alter table study_sessions add column if not exists status text not null default 'pending' check (status in ('pending', 'active', 'awaiting_reflection', 'completed', 'declined', 'expired'));
alter table study_sessions add column if not exists accepted_at timestamptz;
alter table study_sessions add column if not exists ends_at timestamptz;
alter table study_sessions add column if not exists starter_reflection text;
alter table study_sessions add column if not exists recipient_reflection text;
alter table study_sessions add column if not exists starter_completed_at timestamptz;
alter table study_sessions add column if not exists recipient_completed_at timestamptz;
alter table study_sessions add column if not exists completed_at timestamptz;

create table if not exists session_feedback (
  id bigint generated always as identity primary key,
  study_session_id bigint not null references study_sessions(id) on delete cascade,
  reviewer_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  partner_present boolean not null,
  commitment smallint not null check (commitment between 1 and 5),
  usefulness smallint not null check (usefulness between 1 and 5),
  created_at timestamptz not null default now(),
  unique (study_session_id, reviewer_telegram_id)
);

-- Question-solving sessions can run with a private video-call room or entirely in the bot.
create table if not exists question_sessions (
  id bigint generated always as identity primary key,
  connection_id bigint not null references connections(id) on delete cascade,
  creator_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  recipient_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 180),
  question_count smallint not null check (question_count between 1 and 100),
  call_mode text not null check (call_mode in ('call', 'no_call')),
  room_url text,
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'declined', 'expired')),
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists question_items (
  id bigint generated always as identity primary key,
  question_session_id bigint not null references question_sessions(id) on delete cascade,
  sender_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  attachment_type text check (attachment_type in ('photo', 'document')),
  attachment_file_id text,
  is_solved boolean not null default false,
  solved_by_telegram_id bigint references profiles(telegram_id) on delete set null,
  created_at timestamptz not null default now(),
  solved_at timestamptz
);

-- A planned time sends both partners a check-in; this powers attendance and punctuality.
create table if not exists study_reminders (
  id bigint generated always as identity primary key,
  connection_id bigint not null references connections(id) on delete cascade,
  creator_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  recipient_telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  reminder_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'closed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists reminder_checkins (
  id bigint generated always as identity primary key,
  reminder_id bigint not null references study_reminders(id) on delete cascade,
  telegram_id bigint not null references profiles(telegram_id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (reminder_id, telegram_id)
);

create table if not exists weekly_report_sends (
  id bigint generated always as identity primary key,
  connection_id bigint not null references connections(id) on delete cascade,
  week_start date not null,
  sent_at timestamptz not null default now(),
  unique (connection_id, week_start)
);

alter table study_tasks add column if not exists completed_by_telegram_id bigint references profiles(telegram_id) on delete set null;
alter table study_tasks add column if not exists completed_at timestamptz;

create index if not exists profiles_match_index on profiles (gender, city, university, academic_year) where is_active;
create index if not exists connections_participant_index on connections (requester_telegram_id, recipient_telegram_id, status);
create index if not exists messages_connection_index on messages (connection_id, created_at desc);
create index if not exists identity_disclosures_recipient_index on identity_disclosures (recipient_telegram_id);
create index if not exists study_tasks_connection_index on study_tasks (connection_id, is_done);
create index if not exists study_sessions_connection_status_index on study_sessions (connection_id, status, started_at desc);
create index if not exists study_reminders_pending_index on study_reminders (status, reminder_at);
create index if not exists question_sessions_connection_index on question_sessions (connection_id, status, created_at desc);
create index if not exists question_items_session_index on question_items (question_session_id, is_solved, created_at);
