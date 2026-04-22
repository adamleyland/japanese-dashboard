create or replace function public.get_tracking_totals(p_user_id uuid default auth.uid())
returns table(metric text, total numeric)
language sql
security invoker
set search_path = public
as $$
  select
    tracking_events.metric,
    coalesce(sum(tracking_events.amount), 0)::numeric as total
  from public.tracking_events
  where tracking_events.user_id = coalesce(p_user_id, auth.uid())
  group by tracking_events.metric;
$$;

grant execute on function public.get_tracking_totals(uuid) to authenticated;
