-- Allow anonymous callers so validate_qr_token can return UNAUTHENTICATED (401)
-- instead of a PostgREST permission error. The function still checks auth.uid().
grant execute on function public.validate_qr_token(text) to anon, authenticated;
