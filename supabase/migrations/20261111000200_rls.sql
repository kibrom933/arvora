-- Arvora: Row Level Security. Grundregel: ingen tabel kan læses eller skrives af klienter uden en policy her.
-- Hemmelige ønsker (wishes) kan KUN læses af den arving, de tilhører. Tovholderen har ingen policy på wishes.
-- Serveren (RPC'er med security definer og service role) går uden om RLS og laver sine egne tjek.

-- ---------- Hjælpefunktioner (security definer, så de må læse estate_members uanset RLS) ----------
create or replace function is_member(e uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from estate_members where estate_id = e and user_id = auth.uid())
$$;
create or replace function is_tovholder(e uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from estate_members where estate_id = e and user_id = auth.uid() and role = 'tovholder')
$$;
create or replace function my_heir_id(e uuid) returns uuid language sql stable security definer set search_path = public as $$
  select heir_id from estate_members where estate_id = e and user_id = auth.uid()
$$;
create or replace function estate_status_of(e uuid) returns estate_status language sql stable security definer set search_path = public as $$
  select status from estates where id = e
$$;
create or replace function run_released(r uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from distribution_runs where id = r and released_at is not null)
$$;
-- Må arvingen ændre sine ønsker nu? Boet er åbent, og hun har ikke låst.
create or replace function can_edit_wishes(h uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from heirs x join estates e on e.id = x.estate_id
    where x.id = h and x.user_id = auth.uid() and x.submitted_at is null and e.status = 'aaben')
$$;
create or replace function is_partner_member(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from partner_members where partner_id = p and user_id = auth.uid())
$$;
revoke all on function is_member(uuid), is_tovholder(uuid), my_heir_id(uuid), estate_status_of(uuid), run_released(uuid), can_edit_wishes(uuid), is_partner_member(uuid) from public;
grant execute on function is_member(uuid), is_tovholder(uuid), my_heir_id(uuid), estate_status_of(uuid), run_released(uuid), can_edit_wishes(uuid), is_partner_member(uuid) to authenticated;

-- ---------- Slå RLS til overalt ----------
alter table estates enable row level security;
alter table estate_members enable row level security;
alter table heirs enable row level security;
alter table invitations enable row level security;
alter table items enable row level security;
alter table item_images enable row level security;
alter table wishes enable row level security;
alter table distribution_runs enable row level security;
alter table distribution_inputs enable row level security;
alter table distribution_explanations enable row level security;
alter table tie_break_records enable row level security;
alter table signatures enable row level security;
alter table consent_records enable row level security;
alter table audit_events enable row level security;
alter table notifications enable row level security;
alter table payments enable row level security;
alter table partners enable row level security;
alter table partner_members enable row level security;
alter table partner_referrals enable row level security;
alter table rate_limits enable row level security;
-- anon (ikke logget ind) har ingen adgang til noget. Alt sker gennem authenticated eller serveren.
revoke all on all tables in schema public from anon;

-- ---------- estates ----------
create policy estates_select on estates for select to authenticated using (is_member(id));
-- Oprettelse sker gennem RPC create_estate (så medlemsrækken følger med). Ingen direkte insert.
create policy estates_update on estates for update to authenticated
  using (is_tovholder(id) and status not in ('afsluttet', 'slettet'))
  with check (is_tovholder(id) and status not in ('slettet'));
-- Status-skift og sletning går gennem RPC'er.

-- ---------- estate_members: kun læsning ----------
create policy members_select on estate_members for select to authenticated using (is_member(estate_id));

-- ---------- heirs ----------
create policy heirs_select on heirs for select to authenticated using (is_member(estate_id));
create policy heirs_insert on heirs for insert to authenticated
  with check (is_tovholder(estate_id) and estate_status_of(estate_id) in ('kladde', 'aaben') and user_id is null and submitted_at is null and proxy_by is null);
create policy heirs_update on heirs for update to authenticated
  using (is_tovholder(estate_id) and estate_status_of(estate_id) in ('kladde', 'aaben'))
  with check (is_tovholder(estate_id));
create policy heirs_delete on heirs for delete to authenticated
  using (is_tovholder(estate_id) and estate_status_of(estate_id) in ('kladde', 'aaben') and submitted_at is null);

-- ---------- invitations: tovholderen kan se status, aldrig token (kun hash gemmes). Oprettes af serveren. ----------
create policy invitations_select on invitations for select to authenticated using (is_tovholder(estate_id));
create policy invitations_revoke on invitations for update to authenticated
  using (is_tovholder(estate_id)) with check (is_tovholder(estate_id) and revoked_at is not null);

-- ---------- items ----------
create policy items_select on items for select to authenticated using (is_member(estate_id));
create policy items_insert on items for insert to authenticated
  with check (is_tovholder(estate_id) and estate_status_of(estate_id) in ('kladde', 'aaben'));
create policy items_update on items for update to authenticated
  using (is_tovholder(estate_id) and estate_status_of(estate_id) in ('kladde', 'aaben'))
  with check (is_tovholder(estate_id));
create policy items_delete on items for delete to authenticated
  using (is_tovholder(estate_id) and estate_status_of(estate_id) in ('kladde', 'aaben'));

create policy images_select on item_images for select to authenticated using (is_member(estate_id));
create policy images_insert on item_images for insert to authenticated
  with check (is_tovholder(estate_id) and estate_status_of(estate_id) in ('kladde', 'aaben'));
create policy images_delete on item_images for delete to authenticated
  using (is_tovholder(estate_id) and estate_status_of(estate_id) in ('kladde', 'aaben'));

-- ---------- wishes: kun ens egne. Tovholderen og de andre arvinger har ingen policy, hverken før eller efter. ----------
create policy wishes_select on wishes for select to authenticated using (heir_id = my_heir_id(estate_id));
create policy wishes_insert on wishes for insert to authenticated
  with check (heir_id = my_heir_id(estate_id) and can_edit_wishes(heir_id)
    and exists (select 1 from items i where i.id = item_id and i.estate_id = wishes.estate_id and i.deleted_at is null and i.will_heir_id is null));
create policy wishes_update on wishes for update to authenticated
  using (heir_id = my_heir_id(estate_id) and can_edit_wishes(heir_id))
  with check (heir_id = my_heir_id(estate_id) and can_edit_wishes(heir_id));
create policy wishes_delete on wishes for delete to authenticated
  using (heir_id = my_heir_id(estate_id) and can_edit_wishes(heir_id));

-- ---------- fordeling ----------
create policy runs_select on distribution_runs for select to authenticated using (is_member(estate_id) and released_at is not null);
-- distribution_inputs: ingen policy. Kun serveren.
create policy explanations_select on distribution_explanations for select to authenticated
  using (run_released(run_id) and heir_id in (select heir_id from estate_members where user_id = auth.uid()));
create policy ties_select on tie_break_records for select to authenticated using (is_member(estate_id) and run_released(run_id));

-- ---------- underskrifter, samtykker ----------
create policy signatures_select on signatures for select to authenticated using (is_member(estate_id));
-- insert kun via RPC sign_run.
create policy consents_select on consent_records for select to authenticated
  using (is_tovholder(estate_id) or heir_id = my_heir_id(estate_id) or user_id = auth.uid());
-- insert kun via RPC'er.

-- ---------- auditlog, beskeder, betaling ----------
create policy audit_select on audit_events for select to authenticated using (estate_id is not null and is_tovholder(estate_id));
create policy notifications_select on notifications for select to authenticated
  using ((estate_id is not null and is_tovholder(estate_id)) or heir_id = my_heir_id(estate_id));
create policy payments_select on payments for select to authenticated using (is_tovholder(estate_id));

-- ---------- partnere ----------
create policy partners_select on partners for select to authenticated using (is_partner_member(id));
create policy partner_members_select on partner_members for select to authenticated using (user_id = auth.uid());
create policy referrals_select on partner_referrals for select to authenticated
  using (is_partner_member(partner_id) or is_tovholder(estate_id));
-- rate_limits: ingen policy, kun serveren.

-- ---------- Kolonner, klienter må skrive. Alt andet er forbeholdt serveren. ----------
-- (En tabelrettighed dækker alle kolonner, så den fjernes først, og kun de tilladte kolonner gives tilbage.)
revoke insert, update, delete on estates from authenticated;
grant update (name, years, mode, method, deadline, retention_days) on estates to authenticated;
revoke insert, update on heirs from authenticated;
grant insert (estate_id, name, relation, phone, email, share, sort) on heirs to authenticated;
grant update (name, relation, phone, email, share, sort) on heirs to authenticated;
revoke insert, update on items from authenticated;
grant insert (estate_id, name, room, kind, description, group_name, valuable, will_heir_id, will_note, will_unclear, ai_suggested) on items to authenticated;
grant update (name, room, kind, description, group_name, valuable, will_heir_id, will_note, will_unclear, ai_suggested, rest_decision, deleted_at) on items to authenticated;
revoke insert, update on wishes from authenticated;
grant insert (estate_id, heir_id, item_id, points, bid) on wishes to authenticated;
grant update (points, bid) on wishes to authenticated;
revoke insert, update, delete on invitations from authenticated;
grant update (revoked_at) on invitations to authenticated;
revoke insert, update, delete on estate_members, distribution_runs, distribution_inputs, distribution_explanations, tie_break_records,
  signatures, consent_records, audit_events, notifications, payments, partners, partner_members, partner_referrals, rate_limits from authenticated;
revoke insert, update, delete on item_images from authenticated;
grant insert (estate_id, item_id, path, bytes) on item_images to authenticated;
grant delete on item_images to authenticated;
