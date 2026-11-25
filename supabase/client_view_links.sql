-- Client view link: ONE link that the admin makes in the admin panel. Anyone who has it can open
-- a read-only page (no account) that shows how many tasks there are and how much work members
-- have done. Making a new link turns the old one off. Only adds new things.

create table if not exists public.client_view_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  label text,
  is_active boolean not null default true,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
alter table public.client_view_links enable row level security;
-- no policies: the table is only reached through the functions below
revoke all on public.client_view_links from anon, authenticated;

create or replace function public.admin_create_client_link(p_label text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea; v_token text; v_row public.client_view_links%rowtype; v_try integer := 0;
begin
  if not public.has_any_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'Not authorized';
  end if;
  -- there is only one client link: a new one replaces the old one
  update public.client_view_links set removed_at = now(), is_active = false where removed_at is null;
  loop
    v_bytes := extensions.gen_random_bytes(16);
    v_token := '';
    for i in 0..15 loop v_token := v_token || substr(v_alpha, (get_byte(v_bytes, i) % 31) + 1, 1); end loop;
    begin
      insert into public.client_view_links(token, label, created_by)
      values (v_token, nullif(left(btrim(coalesce(p_label, '')), 80), ''), auth.uid())
      returning * into v_row;
      exit;
    exception when unique_violation then
      v_try := v_try + 1; if v_try >= 5 then raise; end if;
    end;
  end loop;
  return to_jsonb(v_row);
end $$;

create or replace function public.admin_get_client_links()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.has_any_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'Not authorized';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', l.id, 'token', l.token, 'label', l.label, 'is_active', l.is_active,
      'view_count', l.view_count, 'last_viewed_at', l.last_viewed_at, 'created_at', l.created_at
    ) order by l.created_at desc)
    from public.client_view_links l where l.removed_at is null), '[]'::jsonb);
end $$;

create or replace function public.admin_set_client_link_active(p_link uuid, p_active boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.has_any_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'Not authorized';
  end if;
  update public.client_view_links set is_active = coalesce(p_active, false) where id = p_link and removed_at is null;
end $$;

create or replace function public.admin_remove_client_link(p_link uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.has_any_role(array['ADMIN'::public.app_role,'SUPER_ADMIN'::public.app_role]) then
    raise exception 'Not authorized';
  end if;
  update public.client_view_links set removed_at = now(), is_active = false where id = p_link and removed_at is null;
end $$;

-- What a client sees. Only totals and task titles: no member names, emails, links or money balances.
create or replace function public.get_client_view(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v public.client_view_links%rowtype;
begin
  select * into v from public.client_view_links
  where token = upper(btrim(coalesce(p_token, ''))) and is_active and removed_at is null;
  if v.id is null then
    return jsonb_build_object('valid', false);
  end if;
  update public.client_view_links set view_count = view_count + 1, last_viewed_at = now() where id = v.id;

  return jsonb_build_object(
    'valid', true,
    'label', v.label,
    'generated_at', now(),
    'stats', (select jsonb_build_object(
        'live_tasks',      (select count(*) from public.survey_tasks t where t.status = 'PUBLISHED' and t.removed_at is null),
        'tasks_total',     (select count(*) from public.survey_tasks t where t.status = 'PUBLISHED' or t.removed_at is not null),
        'completed',       (select count(*) from public.survey_submissions s where s.status = 'APPROVED'),
        'in_review',       (select count(*) from public.survey_submissions s where s.status = 'PENDING'),
        'submitted',       (select count(*) from public.survey_submissions s),
        'workers',         (select count(distinct s.user_id) from public.survey_submissions s where s.status = 'APPROVED'),
        'members',         (select count(*) from public.profiles p where not coalesce(p.is_banned, false)),
        'verified_members',(select count(*) from public.profiles p where p.is_verified and not coalesce(p.is_banned, false)),
        'paid_to_workers', (select coalesce(sum(s.reward), 0) from public.survey_submissions s where s.status = 'APPROVED'),
        'completed_7d',    (select count(*) from public.survey_submissions s where s.status = 'APPROVED' and coalesce(s.reviewed_at, s.submitted_at) >= now() - interval '7 days'),
        'completed_today', (select count(*) from public.survey_submissions s where s.status = 'APPROVED' and coalesce(s.reviewed_at, s.submitted_at) >= date_trunc('day', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka')
      )),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'completed', d.n) order by d.day), '[]'::jsonb) from (
        select g.day::date as day,
               (select count(*) from public.survey_submissions s
                 where s.status = 'APPROVED'
                   and (coalesce(s.reviewed_at, s.submitted_at) at time zone 'Asia/Dhaka')::date = g.day::date) as n
        from generate_series((now() at time zone 'Asia/Dhaka')::date - 29, (now() at time zone 'Asia/Dhaka')::date, interval '1 day') g(day)
      ) d),
    'tasks', (select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'title', t.title,
          'platform', lower(substring(t.target_url from '^[a-zA-Z]+://(?:www\.)?([^/:?#]+)')),
          'reward', t.reward,
          'sector', ws.name,
          'created_at', t.created_at,
          'live', t.status = 'PUBLISHED' and t.removed_at is null,
          'completed', (select count(*) from public.survey_submissions s where s.task_id = t.id and s.status = 'APPROVED'),
          'in_review', (select count(*) from public.survey_submissions s where s.task_id = t.id and s.status = 'PENDING')
        ) as x
        from public.survey_tasks t
        left join public.work_sectors ws on ws.id = t.sector_id
        where t.status = 'PUBLISHED' and t.removed_at is null
        order by t.created_at desc
        limit 60
      ) q),
    'recent', (select coalesce(jsonb_agg(r order by r->>'at' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'task', t.title,
          'member', 'Member #' || upper(substr(md5(s.user_id::text), 1, 4)),
          'at', coalesce(s.reviewed_at, s.submitted_at)
        ) as r
        from public.survey_submissions s
        join public.survey_tasks t on t.id = s.task_id
        where s.status = 'APPROVED'
        order by coalesce(s.reviewed_at, s.submitted_at) desc
        limit 20
      ) q2)
  );
end $$;

revoke all on function public.admin_create_client_link(text) from public, anon;
revoke all on function public.admin_get_client_links() from public, anon;
revoke all on function public.admin_set_client_link_active(uuid, boolean) from public, anon;
revoke all on function public.admin_remove_client_link(uuid) from public, anon;
grant execute on function public.admin_create_client_link(text) to authenticated;
grant execute on function public.admin_get_client_links() to authenticated;
grant execute on function public.admin_set_client_link_active(uuid, boolean) to authenticated;
grant execute on function public.admin_remove_client_link(uuid) to authenticated;
revoke all on function public.get_client_view(text) from public;
grant execute on function public.get_client_view(text) to anon, authenticated;
