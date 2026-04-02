create or replace function double_down(
  p_user_id text,
  p_bet_id uuid,
  p_points integer
) returns void language plpgsql as $$
declare
  v_current_balance integer;
  v_deadline timestamptz;
  v_status text;
  v_entry_id uuid;
begin
  -- Must have an existing entry
  select id into v_entry_id
  from bet_entries
  where bet_id = p_bet_id and user_id = p_user_id;

  if v_entry_id is null then
    raise exception 'no existing bet to double down on';
  end if;

  -- Lock balance row
  select points into v_current_balance
  from balances where user_id = p_user_id for update;

  if v_current_balance < p_points then
    raise exception 'insufficient balance';
  end if;

  -- Bet must still be open and before deadline
  select deadline, status into v_deadline, v_status
  from bets where id = p_bet_id;

  if v_status != 'open' then
    raise exception 'bet is not open';
  end if;

  if now() > v_deadline then
    raise exception 'bet deadline has passed';
  end if;

  -- Deduct and add to existing stake atomically
  update balances set points = points - p_points where user_id = p_user_id;
  update bet_entries set points_staked = points_staked + p_points where id = v_entry_id;
end;
$$;
