-- Feed bets: standalone bets posted to followers' feeds
alter table bets add column if not exists audience text not null default 'event';
-- 'event' = belongs to an event/group (existing behavior)
-- 'followers' = feed post, visible to followers

create index if not exists bets_audience_creator_idx on bets(creator_id, created_at desc) where audience = 'followers';
