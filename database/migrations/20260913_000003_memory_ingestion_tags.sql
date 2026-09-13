alter table public.memories
add column if not exists tags text[] not null default '{}'::text[];

create index if not exists memories_tags_gin_idx on public.memories using gin (tags);
