alter table public.tracking_events
add column if not exists client_event_id text;

create unique index if not exists tracking_events_user_metric_client_event_id_key
on public.tracking_events (user_id, metric, client_event_id)
where client_event_id is not null;
