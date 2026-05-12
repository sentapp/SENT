-- Partner touchpoint logging: email and in-person meeting as first-class comm types.
alter type public.communication_type add value if not exists 'email';
alter type public.communication_type add value if not exists 'meeting';
