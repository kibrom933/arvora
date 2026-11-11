-- Alle i boet skal kunne se, at der er bedt om en ny runde, og hvem der har sagt ja. Andre samtykker er stadig egne.
drop policy if exists consents_select on consent_records;
create policy consents_select on consent_records for select to authenticated
  using (is_tovholder(estate_id) or heir_id = my_heir_id(estate_id) or user_id = auth.uid() or (kind = 'ny_runde' and is_member(estate_id)));
