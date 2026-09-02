-- Migration 085: only the bet creator (or admin) can resolve a bet.
-- Removes the community-resolve-after-deadline logic entirely.
create or replace function resolve_bet(
  p_resolver_id text,
  p_bet_id uuid,
  p_winning_option_id uuid
) returns void language plpgsql as $$
declare
  v_total_pot        integer;
  v_winner_stakes    integer;
  v_distributed      integer;
  v_remainder        integer;
  v_creator          text;
  v_status           text;
  v_admin_id constant text := 'did:privy:cmng3anf401zu0cibp1adsvn3';
begin
  select status, creator_id
    into v_status, v_creator
    from bets where id = p_bet_id for update;

  if v_status != 'open' then
    raise exception 'bet already resolved';
  end if;

  if p_resolver_id != v_creator and p_resolver_id != v_admin_id then
    raise exception 'not authorized to resolve this bet';
  end if;

  select coalesce(sum(points_staked), 0) into v_total_pot
  from bet_entries where bet_id = p_bet_id;

  select coalesce(sum(points_staked), 0) into v_winner_stakes
  from bet_entries
  where bet_id = p_bet_id and option_id = p_winning_option_id;

  if v_winner_stakes = 0 then
    -- No one picked this side (or winning_option_id is null) — refund everyone
    update balances b
    set points = points + be.points_staked
    from bet_entries be
    where be.bet_id = p_bet_id and be.user_id = b.user_id;
  else
    -- Pay each winner proportionally to their stake (floor division)
    update balances b
    set points = points + floor(v_total_pot::numeric * be.points_staked / v_winner_stakes)::integer
    from bet_entries be
    where be.bet_id = p_bet_id
      and be.option_id = p_winning_option_id
      and be.user_id = b.user_id;

    select coalesce(sum(floor(v_total_pot::numeric * points_staked / v_winner_stakes)::integer), 0)
    into v_distributed
    from bet_entries
    where bet_id = p_bet_id and option_id = p_winning_option_id;

    v_remainder := v_total_pot - v_distributed;

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
