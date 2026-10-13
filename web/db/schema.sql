create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  currency_code text not null check (currency_code in ('NZD','AUD','USD','GBP','EUR')),
  timezone text not null default 'Pacific/Auckland',
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','manager','staff','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create index members_user_idx on public.organization_members(user_id,organization_id) where active;
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) between 2 and 120),
  email text not null default '',
  phone text not null default '',
  lead_time_days integer not null default 3 check (lead_time_days between 0 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id,id)
);
create index suppliers_org_idx on public.suppliers(organization_id,name);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sku text not null check (length(btrim(sku)) between 1 and 40),
  name text not null check (length(btrim(name)) between 1 and 120),
  category text not null default 'General' check (length(category) between 1 and 60),
  supplier_id uuid,
  reorder_point integer not null default 10 check (reorder_point between 0 and 1000000),
  unit_cost_cents bigint not null default 0 check (unit_cost_cents between 0 and 100000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id,supplier_id) references public.suppliers(organization_id,id)
);
create unique index products_sku_idx on public.products(organization_id,upper(sku));
create index products_supplier_idx on public.products(organization_id,supplier_id);
create index products_name_idx on public.products(organization_id,name);
create table public.inventory_balances (
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null,
  quantity bigint not null default 0 check (quantity between 0 and 1000000000),
  value_cents bigint not null default 0 check (value_cents between 0 and 9000000000000000),
  updated_at timestamptz not null default now(),
  primary key (organization_id,product_id),
  foreign key (organization_id,product_id) references public.products(organization_id,id)
);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null,
  kind text not null check (kind in ('receipt','issue','adjustment')),
  quantity_delta bigint not null check (quantity_delta <> 0),
  value_delta_cents bigint not null,
  reason text not null check (length(btrim(reason)) between 3 and 240),
  created_by uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  idempotency_key uuid not null,
  request_hash text not null,
  unique (organization_id,idempotency_key),
  foreign key (organization_id,product_id) references public.products(organization_id,id)
);
create index movements_history_idx on public.inventory_movements(organization_id,occurred_at desc,id desc);
create index movements_product_idx on public.inventory_movements(organization_id,product_id);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid not null references auth.users(id),
  action text not null,
  entity_id uuid not null,
  occurred_at timestamptz not null default now()
);
create index audit_org_idx on public.audit_events(organization_id,occurred_at desc);
create index audit_actor_idx on public.audit_events(actor_id);
create index movements_actor_idx on public.inventory_movements(created_by);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_events enable row level security;

create policy members_self_read on public.organization_members for select to authenticated
using (user_id=(select auth.uid()) and active);
create policy organizations_member_read on public.organizations for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=organizations.id and m.user_id=(select auth.uid()) and m.active));
create policy suppliers_member_read on public.suppliers for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=suppliers.organization_id and m.user_id=(select auth.uid()) and m.active));
create policy products_member_read on public.products for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=products.organization_id and m.user_id=(select auth.uid()) and m.active));
create policy balances_member_read on public.inventory_balances for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=inventory_balances.organization_id and m.user_id=(select auth.uid()) and m.active));
create policy movements_member_read on public.inventory_movements for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=inventory_movements.organization_id and m.user_id=(select auth.uid()) and m.active));
create policy audit_owner_read on public.audit_events for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=audit_events.organization_id and m.user_id=(select auth.uid()) and m.active and m.role='owner'));
create policy suppliers_manager_insert on public.suppliers for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id=suppliers.organization_id and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','manager')));
create policy suppliers_manager_update on public.suppliers for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=suppliers.organization_id and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','manager')))
with check (exists (select 1 from public.organization_members m where m.organization_id=suppliers.organization_id and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','manager')));
create policy products_manager_insert on public.products for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id=products.organization_id and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','manager')));
create policy products_manager_update on public.products for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=products.organization_id and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','manager')))
with check (exists (select 1 from public.organization_members m where m.organization_id=products.organization_id and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','manager')));

revoke all on all tables in schema public from anon;
revoke all on public.organizations,public.organization_members,public.products,public.suppliers,public.inventory_balances,public.inventory_movements,public.audit_events from authenticated;
grant select on public.organizations,public.organization_members,public.products,public.suppliers,public.inventory_balances,public.inventory_movements,public.audit_events to authenticated;
grant insert on public.products,public.suppliers to authenticated;
-- Column privileges prevent moving existing catalog records between tenants.
grant update(sku,name,category,supplier_id,reorder_point,unit_cost_cents) on public.products to authenticated;
grant update(name,email,phone,lead_time_days) on public.suppliers to authenticated;

create function private.post_stock(
  p_organization uuid,p_product uuid,p_kind text,p_quantity integer,
  p_unit_cost bigint,p_reason text,p_idempotency uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  delta bigint;
  delta_value bigint;
  balance public.inventory_balances%rowtype;
  existing public.inventory_movements%rowtype;
  fingerprint text;
  movement_id uuid;
begin
  if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
  select m.role into actor_role from public.organization_members m
  where m.organization_id=p_organization and m.user_id=actor and m.active for share;
  if actor_role is null or actor_role not in ('owner','manager','staff') then raise exception 'permission denied'; end if;
  if p_kind is null or p_kind not in ('receipt','issue','adjustment')
     or p_quantity is null or p_quantity=0 or abs(p_quantity::bigint)>1000000
     or p_unit_cost is null or p_unit_cost<0 or p_unit_cost>100000000
     or p_reason is null or length(btrim(p_reason)) not between 3 and 240
     or p_idempotency is null then raise exception 'invalid stock movement'; end if;
  if p_kind in ('receipt','issue') and p_quantity<0 then raise exception 'quantity must be positive'; end if;
  fingerprint := md5(jsonb_build_array(p_product,p_kind,p_quantity,p_unit_cost,btrim(p_reason))::text);
  -- Serialize identical retry keys before checking their original payload.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization::text || p_idempotency::text,0));
  select * into existing from public.inventory_movements
  where organization_id=p_organization and idempotency_key=p_idempotency;
  if found then
    if existing.request_hash<>fingerprint then raise exception 'idempotency payload conflict'; end if;
    return existing.id;
  end if;
  perform 1 from public.products where organization_id=p_organization and id=p_product and active for share;
  if not found then raise exception 'product unavailable'; end if;
  insert into public.inventory_balances(organization_id,product_id) values(p_organization,p_product) on conflict do nothing;
  select * into balance from public.inventory_balances
  where organization_id=p_organization and product_id=p_product for update;
  delta := case when p_kind='issue' then -p_quantity else p_quantity end;
  if balance.quantity+delta<0 then raise exception 'insufficient stock'; end if;
  if delta>0 then delta_value:=delta*p_unit_cost;
  elsif delta=-balance.quantity then delta_value:=-balance.value_cents;
  else delta_value:=-round(balance.value_cents::numeric*abs(delta)/balance.quantity)::bigint;
  end if;
  insert into public.inventory_movements(organization_id,product_id,kind,quantity_delta,value_delta_cents,reason,created_by,idempotency_key,request_hash)
  values(p_organization,p_product,p_kind,delta,delta_value,btrim(p_reason),actor,p_idempotency,fingerprint) returning id into movement_id;
  update public.inventory_balances set quantity=quantity+delta,value_cents=value_cents+delta_value,updated_at=now()
  where organization_id=p_organization and product_id=p_product;
  insert into public.audit_events(organization_id,actor_id,action,entity_id) values(p_organization,actor,'stock.' || p_kind,movement_id);
  return movement_id;
end;
$$;
revoke all on function private.post_stock(uuid,uuid,text,integer,bigint,text,uuid) from public,anon;
grant execute on function private.post_stock(uuid,uuid,text,integer,bigint,text,uuid) to authenticated;
create function public.post_stock(p_organization uuid,p_product uuid,p_kind text,p_quantity integer,p_unit_cost bigint,p_reason text,p_idempotency uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.post_stock(p_organization,p_product,p_kind,p_quantity,p_unit_cost,p_reason,p_idempotency);
$$;
revoke all on function public.post_stock(uuid,uuid,text,integer,bigint,text,uuid) from public,anon;
grant execute on function public.post_stock(uuid,uuid,text,integer,bigint,text,uuid) to authenticated;

create function private.create_workspace(p_name text,p_currency text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); org_id uuid;
begin
  if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'; end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 100 or p_currency is null or p_currency not in ('NZD','AUD','USD','GBP','EUR') then raise exception 'invalid workspace'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
  select organization_id into org_id from public.organization_members where user_id=actor and active order by created_at limit 1;
  if org_id is not null then return org_id; end if;
  insert into public.organizations(name,currency_code) values(btrim(p_name),p_currency) returning id into org_id;
  insert into public.organization_members(organization_id,user_id,role) values(org_id,actor,'owner');
  insert into public.audit_events(organization_id,actor_id,action,entity_id) values(org_id,actor,'workspace.created',org_id);
  return org_id;
end;
$$;
revoke all on function private.create_workspace(text,text) from public,anon;
grant execute on function private.create_workspace(text,text) to authenticated;
create function public.create_workspace(p_name text,p_currency text) returns uuid
language sql security invoker set search_path='' as $$ select private.create_workspace(p_name,p_currency); $$;
revoke all on function public.create_workspace(text,text) from public,anon;
grant execute on function public.create_workspace(text,text) to authenticated;

comment on function private.post_stock(uuid,uuid,text,integer,bigint,text,uuid) is
'Authorized, idempotent single-location stock posting. Weighted-average issue value is calculated under a row lock. Ledger writes are unavailable to API roles.';
