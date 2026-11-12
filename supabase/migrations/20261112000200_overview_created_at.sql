-- Oversigten over boer viser de nyeste først og skal derfor have oprettelsestidspunktet. anon har intet at gøre her.
create or replace view estate_overview with (security_invoker = true) as
select e.id, e.name, e.status, e.method, e.mode, e.deadline, e.paid_at, e.closed_at, e.retention_until,
  (select count(*) from heirs h where h.estate_id = e.id) as heirs,
  (select count(*) from heirs h where h.estate_id = e.id and h.submitted_at is not null) as submitted,
  (select count(*) from items i where i.estate_id = e.id and i.deleted_at is null) as items,
  (select count(*) from signatures s join distribution_runs r on r.id = s.run_id where r.estate_id = e.id and r.superseded_at is null) as signed,
  e.created_at
from estates e;
revoke all on estate_overview from anon, public;
grant select on estate_overview to authenticated;
