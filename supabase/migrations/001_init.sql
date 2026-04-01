-- Users / balances
create table balances (
  user_id text primary key,
  points integer not null default 1000,
  created_at timestamptz not null default now()
);

-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date timestamptz not null,
  host_id text not null references balances(user_id),
  invite_token text not null unique,
  source text,                -- 'partiful' | 'luma' | 'groupme' | null (native)
  external_id text,           -- their event ID, for dedup
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

-- Event guests (populated when someone joins via invite link)
create table event_guests (
  event_id uuid not null references events(id) on delete cascade,
  user_id text not null references balances(user_id),
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Bets
create table bets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  creator_id text not null references balances(user_id),
  question text not null check (char_length(question) <= 200),
  deadline timestamptz not null,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  winning_option_id uuid,
  resolved_at timestamptz,
  resolved_by text references balances(user_id),
  created_at timestamptz not null default now()
);

-- Bet options (separate table, not array)
create table bet_options (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets(id) on delete cascade,
  label text not null check (char_length(label) <= 100),
  created_at timestamptz not null default now()
);

-- Add FK now that bet_options exists
alter table bets
  add constraint bets_winning_option_fk
  foreign key (winning_option_id) references bet_options(id);

-- Bet entries (one per user per bet)
create table bet_entries (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets(id) on delete cascade,
  user_id text not null references balances(user_id),
  option_id uuid not null references bet_options(id),
  points_staked integer not null check (points_staked > 0),
  created_at timestamptz not null default now(),
  unique (bet_id, user_id)
);

-- Atomic bet placement: check balance, deduct, insert entry
create or replace function place_bet(
  p_user_id text,
  p_bet_id uuid,
  p_option_id uuid,
  p_points integer
) returns void language plpgsql as $$
declare
  v_current_balance integer;
  v_deadline timestamptz;
  v_status text;
begin
  -- Lock the user's balance row
  select points into v_current_balance
  from balances
  where user_id = p_user_id
  for update;

  if v_current_balance is null then
    raise exception 'user not found';
  end if;

  if v_current_balance < p_points then
    raise exception 'insufficient balance';
  end if;

  -- Check bet is still open and before deadline
  select deadline, status into v_deadline, v_status
  from bets where id = p_bet_id;

  if v_status != 'open' then
    raise exception 'bet is not open';
  end if;

  if now() > v_deadline then
    raise exception 'bet deadline has passed';
  end if;

  -- Deduct points
  update balances set points = points - p_points where user_id = p_user_id;

  -- Insert entry (unique constraint prevents double-betting)
  insert into bet_entries (bet_id, user_id, option_id, points_staked)
  values (p_bet_id, p_user_id, p_option_id, p_points);
end;
$$;

-- Atomic resolution: pick winner, distribute points equally, handle no-winner refund
create or replace function resolve_bet(
  p_resolver_id text,
  p_bet_id uuid,
  p_winning_option_id uuid
) returns void language plpgsql as $$
declare
  v_total_pot integer;
  v_winner_count integer;
  v_payout_each integer;
  v_remainder integer;
  v_event_host text;
  v_creator text;
  v_status text;
begin
  -- Check bet exists and is open
  select status, creator_id into v_status, v_creator
  from bets where id = p_bet_id for update;

  if v_status != 'open' then
    raise exception 'bet already resolved';
  end if;

  -- Only creator or event host can resolve
  select host_id into v_event_host
  from events e
  join bets b on b.event_id = e.id
  where b.id = p_bet_id;

  if p_resolver_id != v_creator and p_resolver_id != v_event_host then
    raise exception 'not authorized to resolve this bet';
  end if;

  -- Get totals
  select coalesce(sum(points_staked), 0) into v_total_pot
  from bet_entries where bet_id = p_bet_id;

  select count(*) into v_winner_count
  from bet_entries
  where bet_id = p_bet_id and option_id = p_winning_option_id;

  if v_winner_count = 0 then
    -- No winners: refund everyone
    update balances b
    set points = points + be.points_staked
    from bet_entries be
    where be.bet_id = p_bet_id and be.user_id = b.user_id;
  else
    -- Equal split among winners
    v_payout_each := v_total_pot / v_winner_count;
    v_remainder := v_total_pot - (v_payout_each * v_winner_count);

    update balances b
    set points = points + v_payout_each
    from bet_entries be
    where be.bet_id = p_bet_id
      and be.option_id = p_winning_option_id
      and be.user_id = b.user_id;

    -- Remainder goes to first winner (deterministic)
    if v_remainder > 0 then
      update balances
      set points = points + v_remainder
      where user_id = (
        select user_id from bet_entries
        where bet_id = p_bet_id and option_id = p_winning_option_id
        order by created_at asc
        limit 1
      );
    end if;
  end if;

  -- Mark resolved
  update bets
  set status = 'resolved',
      winning_option_id = p_winning_option_id,
      resolved_at = now(),
      resolved_by = p_resolver_id
  where id = p_bet_id;
end;
$$;
