-- Emergency contact on registration must be a 10-digit national number (digits only).

update public.registration_field_definitions
set validation = '{"regex":"^[0-9]{10}$"}'::jsonb
where field_key = 'emergency_contact';
