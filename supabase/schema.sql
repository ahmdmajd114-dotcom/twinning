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
alter table profiles add column if not exists preferences_notified_at timestamptz;

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

create index if not exists profiles_match_index on profiles (gender, city, university, academic_year) where is_active;
create index if not exists connections_participant_index on connections (requester_telegram_id, recipient_telegram_id, status);
create index if not exists messages_connection_index on messages (connection_id, created_at desc);
create index if not exists identity_disclosures_recipient_index on identity_disclosures (recipient_telegram_id);
create index if not exists study_tasks_connection_index on study_tasks (connection_id, is_done);
