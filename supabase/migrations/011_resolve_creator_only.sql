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
  v_creator text;
  v_status text;
begin
  select status, creator_id into v_status, v_creator
  from bets where id = p_bet_id for update;

  if v_status != 'open' then
    raise exception 'bet already resolved';
  end if;

  if p_resolver_id != v_creator then
    raise exception 'not authorized to resolve this bet';
  end if;

  select coalesce(sum(points_staked), 0) into v_total_pot
  from bet_entries where bet_id = p_bet_id;

  select count(*) into v_winner_count
  from bet_entries
  where bet_id = p_bet_id and option_id = p_winning_option_id;

  if v_winner_count = 0 then
    update balances b
    set points = points + be.points_staked
    from bet_entries be
    where be.bet_id = p_bet_id and be.user_id = b.user_id;
  else
    v_payout_each := v_total_pot / v_winner_count;
    v_remainder := v_total_pot - (v_payout_each * v_winner_count);

    update balances b
    set points = points + v_payout_each
    from bet_entries be
    where be.bet_id = p_bet_id
      and be.option_id = p_winning_option_id
      and be.user_id = b.user_id;

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

  update bets
  set status = 'resolved',
      winning_option_id = p_winning_option_id,
      resolved_at = now(),
      resolved_by = p_resolver_id
  where id = p_bet_id;
end;
$$;
