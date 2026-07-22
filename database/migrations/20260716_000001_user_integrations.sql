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
