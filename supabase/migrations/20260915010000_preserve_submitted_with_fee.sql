-- Preserve in-flight registrations from the pre-allocation workflow.
-- Old flow: submit set committee_id + expected_fee_minor and status SUBMITTED (ready to pay).
-- New flow: SUBMITTED means awaiting allocation; payment requires PAYMENT_PENDING.
-- Without this, already-submitted paid-ready delegates would be stuck after deploy.

update public.registrations
set status = 'PAYMENT_PENDING'
where deleted_at is null
  and status = 'SUBMITTED'
  and committee_id is not null
  and expected_fee_minor is not null;

notify pgrst, 'reload schema';
