-- Storage insert: owner is not always populated before WITH CHECK on the REST upload path.
drop policy if exists payment_proofs_insert on storage.objects;
create policy payment_proofs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and auth.uid() is not null);

drop policy if exists payment_proofs_update on storage.objects;
create policy payment_proofs_update on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-proofs' and (owner = auth.uid() or owner is null))
  with check (bucket_id = 'payment-proofs');
