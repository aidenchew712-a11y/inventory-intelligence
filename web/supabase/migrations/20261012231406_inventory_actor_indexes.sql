create index audit_actor_idx on public.audit_events(actor_id);
create index movements_actor_idx on public.inventory_movements(created_by);