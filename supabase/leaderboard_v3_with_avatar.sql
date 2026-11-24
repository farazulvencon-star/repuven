-- Leaderboard with profile photos.
-- Run once in Supabase: SQL Editor > New query > paste all of this > Run.
-- It only ADDS a new function (get_referral_leaderboard_v3). Nothing is deleted or changed;
-- the old get_referral_leaderboard_v2 stays as it is.

create or replace function public.get_referral_leaderboard_v3(p_limit integer default 10)
 returns table(rank integer, full_name text, total_referrals bigint, qualified_referrals bigint, referral_earnings numeric, prize_amount numeric, campaign_title text, campaign_description text, campaign_ends_at timestamp with time zone, campaign_status text, leader_level smallint, avatar_url text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_campaign public.referral_prize_campaigns%rowtype;
  v_cutoff timestamptz := now();
begin
  select c.* into v_campaign
  from public.referral_prize_campaigns c
  where c.status<>'CANCELLED'
    and c.starts_at<=now()
  order by
    case when c.status='ACTIVE' and now()<c.ends_at then 0 else 1 end,
    c.created_at desc
  limit 1;

  if v_campaign.id is not null and now()>=v_campaign.ends_at then
    v_cutoff:=v_campaign.ends_at;
  end if;

  return query
  with ranked as (
    select
      row_number() over(
        order by
          count(r.id) filter (where r.status='QUALIFIED' and r.qualified_at is not null and r.qualified_at<=v_cutoff) desc,
          coalesce(w.referral_earnings,0) desc,
          p.created_at asc
      )::int as rank,
      coalesce(nullif(trim(p.full_name),''),'Member') as full_name,
      count(r.id)::bigint as total_referrals,
      count(r.id) filter (where r.status='QUALIFIED' and r.qualified_at is not null and r.qualified_at<=v_cutoff)::bigint as qualified_referrals,
      coalesce(w.referral_earnings,0) as referral_earnings,
      coalesce(lm.level,0)::smallint as leader_level,
      nullif(trim(p.avatar_url),'') as avatar_url
    from public.profiles p
    left join public.referrals r on r.referrer_id=p.id
    left join public.wallets w on w.user_id=p.id
    left join public.leadership_members lm on lm.user_id=p.id
    where coalesce(p.show_on_leaderboard,true)
      and not coalesce(p.is_banned,false)
      and not coalesce(p.is_suspended,false)
    group by p.id,p.full_name,w.referral_earnings,p.created_at,lm.level,p.avatar_url
    having count(r.id) filter (where r.status='QUALIFIED' and r.qualified_at is not null and r.qualified_at<=v_cutoff) > 0
    order by
      count(r.id) filter (where r.status='QUALIFIED' and r.qualified_at is not null and r.qualified_at<=v_cutoff) desc,
      coalesce(w.referral_earnings,0) desc,
      p.created_at asc
    limit greatest(1,least(coalesce(p_limit,10),50))
  )
  select
    x.rank, x.full_name, x.total_referrals, x.qualified_referrals, x.referral_earnings,
    case
      when v_campaign.id is null then 0::numeric
      when x.rank=1 then v_campaign.first_prize
      when x.rank=2 then v_campaign.second_prize
      when x.rank=3 then v_campaign.third_prize
      else 0::numeric
    end,
    v_campaign.title, v_campaign.description, v_campaign.ends_at,
    case
      when v_campaign.id is null then null
      when now()>=v_campaign.ends_at then 'ENDED'
      else 'ACTIVE'
    end,
    x.leader_level,
    x.avatar_url
  from ranked x
  order by x.rank;
end;
$function$;

revoke all on function public.get_referral_leaderboard_v3(integer) from public, anon;
grant execute on function public.get_referral_leaderboard_v3(integer) to authenticated, service_role;
