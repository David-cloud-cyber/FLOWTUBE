create or replace function public.request_affiliate_payout(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_row public.affiliate_accounts%rowtype;
  available numeric(12,2);
  payout_id uuid;
begin
  select * into account_row
  from public.affiliate_accounts
  where user_id = p_user_id
  for update;

  if not found or account_row.payout_email is null then
    raise exception 'PAYOUT_NOT_CONFIGURED';
  end if;

  select coalesce(sum(amount_usd), 0)::numeric(12,2)
    into available
  from public.affiliate_referrals
  where affiliate_user_id = p_user_id and status = 'active';

  if available < coalesce(account_row.min_payout_usd, 50) then
    raise exception 'PAYOUT_THRESHOLD';
  end if;

  update public.affiliate_referrals
  set status = 'paid'
  where affiliate_user_id = p_user_id and status = 'active';

  insert into public.affiliate_payouts (
    affiliate_user_id, amount_usd, payout_method, destination_masked, metadata
  ) values (
    p_user_id,
    available,
    coalesce(account_row.payout_method, 'email'),
    regexp_replace(account_row.payout_email, '(^.).*(@.*$)', '\1***\2'),
    jsonb_build_object('source', 'affiliate_dashboard')
  ) returning id into payout_id;

  perform public.sync_affiliate_account_totals(p_user_id);
  return jsonb_build_object('id', payout_id, 'amount_usd', available, 'status', 'pending');
end;
$$;

revoke all on function public.request_affiliate_payout(uuid) from public, anon, authenticated;
grant execute on function public.request_affiliate_payout(uuid) to service_role;
