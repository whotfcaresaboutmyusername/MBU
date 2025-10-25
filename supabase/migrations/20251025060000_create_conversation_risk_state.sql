create table if not exists conversation_risk_state (
  conversation_hash text primary key,
  risk_score numeric not null default 0,
  last_event text,
  last_actor_hash text,
  last_event_severity text,
  last_event_meta jsonb,
  last_event_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function set_conversation_risk_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_conversation_risk_updated_at on conversation_risk_state;

create trigger trg_conversation_risk_updated_at
before update on conversation_risk_state
for each row
execute function set_conversation_risk_updated_at();

alter table conversation_risk_state enable row level security;

drop policy if exists "service_role_manage_conversation_risk" on conversation_risk_state;

create policy "service_role_manage_conversation_risk"
on conversation_risk_state
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
