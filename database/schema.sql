create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  source_app text not null,
  importance_score numeric(4, 3) not null default 0.500,
  tags text[] not null default '{}'::text[],
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_importance_score_check check (importance_score >= 0 and importance_score <= 1)
);

create index if not exists memories_source_app_idx on public.memories (source_app);
create index if not exists memories_created_at_idx on public.memories (created_at desc);
create index if not exists memories_importance_score_idx on public.memories (importance_score desc);
create index if not exists memories_embedding_ivfflat_idx on public.memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create trigger set_memories_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  messages jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_created_at_idx on public.conversations (created_at desc);

create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entities_type_idx on public.entities (entity_type);
create index if not exists entities_name_idx on public.entities (name);

create trigger set_entities_updated_at
before update on public.entities
for each row execute function public.set_updated_at();

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  source_entity_id uuid not null references public.entities(id) on delete cascade,
  target_entity_id uuid not null references public.entities(id) on delete cascade,
  relationship_type text not null,
  weight numeric(4, 3) not null default 0.500,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationships_weight_check check (weight >= 0 and weight <= 1)
);

create index if not exists relationships_source_idx on public.relationships (source_entity_id);
create index if not exists relationships_target_idx on public.relationships (target_entity_id);
create index if not exists relationships_type_idx on public.relationships (relationship_type);

create trigger set_relationships_updated_at
before update on public.relationships
for each row execute function public.set_updated_at();

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  agent_name text not null,
  status text not null,
  current_task text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  progress_percentage integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_logs_progress_percentage_check check (progress_percentage >= 0 and progress_percentage <= 100)
);

create index if not exists agent_logs_agent_name_idx on public.agent_logs (agent_name);
create index if not exists agent_logs_started_at_idx on public.agent_logs (started_at desc);
create index if not exists agent_logs_status_idx on public.agent_logs (status);

create trigger set_agent_logs_updated_at
before update on public.agent_logs
for each row execute function public.set_updated_at();

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_integrations_user_provider_key unique (user_id, provider)
);

create index if not exists user_integrations_user_id_idx on public.user_integrations (user_id);
create index if not exists user_integrations_provider_idx on public.user_integrations (provider);
create index if not exists user_integrations_expires_at_idx on public.user_integrations (expires_at asc);

create trigger set_user_integrations_updated_at
before update on public.user_integrations
for each row execute function public.set_updated_at();
