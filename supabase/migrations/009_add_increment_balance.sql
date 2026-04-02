create or replace function increment_balance(p_user_id text, p_amount integer)
returns void language plpgsql as $$
begin
  update balances set points = points + p_amount where user_id = p_user_id;
end;
$$;
