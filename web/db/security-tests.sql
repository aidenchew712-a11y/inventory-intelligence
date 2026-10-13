-- Disposable fixtures and all mutations are rolled back at the end of the test.
begin;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000001','inventory-test-a@example.invalid'),
('00000000-0000-4000-8000-000000000002','inventory-test-b@example.invalid');
insert into public.organizations(id,name,currency_code) values
('10000000-0000-4000-8000-000000000001','Test tenant A','NZD'),
('10000000-0000-4000-8000-000000000002','Test tenant B','NZD');
insert into public.organization_members(organization_id,user_id,role) values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','viewer');
insert into public.products(id,organization_id,sku,name,category) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','TEST-A','Tenant A stock','Test'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','TEST-B','Tenant B stock','Test');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare movement uuid; replay uuid; row_count integer;
begin
  select count(*) into row_count from public.products;
  if row_count<>1 then raise exception 'FAIL: tenant isolation'; end if;
  movement:=public.post_stock('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','receipt',3,100,'Test receipt','30000000-0000-4000-8000-000000000001');
  replay:=public.post_stock('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','receipt',3,100,'Test receipt','30000000-0000-4000-8000-000000000001');
  if movement<>replay then raise exception 'FAIL: replay idempotency'; end if;
  begin
    perform public.post_stock('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','receipt',4,100,'Test receipt','30000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: reused key accepted another payload';
  exception when others then if sqlerrm not like '%idempotency payload conflict%' then raise; end if; end;
  begin
    perform public.post_stock('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','issue',4,0,'Oversell test','30000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: negative stock allowed';
  exception when others then if sqlerrm not like '%insufficient stock%' then raise; end if; end;
  perform public.post_stock('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','issue',3,999,'Full depletion','30000000-0000-4000-8000-000000000003');
  if exists(select 1 from public.inventory_balances where quantity<>0 or value_cents<>0) then raise exception 'FAIL: valuation residue'; end if;
  begin
    insert into public.inventory_balances(organization_id,product_id) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: direct balance write allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.post_stock('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','receipt',1,100,'Cross tenant','30000000-0000-4000-8000-000000000004');
    raise exception 'FAIL: cross-tenant RPC accepted';
  exception when others then if sqlerrm not like '%permission denied%' then raise; end if; end;
end;
$$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
  begin
    insert into public.products(organization_id,sku,name,category) values('10000000-0000-4000-8000-000000000002','FORBIDDEN','Viewer write','Test');
    raise exception 'FAIL: viewer catalog write allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.post_stock('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','receipt',1,100,'Viewer receipt','30000000-0000-4000-8000-000000000005');
    raise exception 'FAIL: viewer stock posting allowed';
  exception when others then if sqlerrm not like '%permission denied%' then raise; end if; end;
end;
$$;
reset role;
select 'PASS: tenant isolation, idempotency, payload conflict, oversell rejection, full depletion, immutable balance grants, cross-tenant RPC denial and viewer permissions' as result;
rollback;
