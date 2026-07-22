alter table if exists public.conversations
add column if not exists messages jsonb not null default '[]'::jsonb;

alter table if exists public.agent_logs
add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

create index if not exists agent_logs_conversation_id_idx
on public.agent_logs (conversation_id);
