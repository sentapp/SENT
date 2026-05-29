-- "Not right now" pipeline status + optional follow-up date on contacts.
alter type public.contact_status add value if not exists 'not_right_now';

alter table public.contacts add column if not exists follow_up_date date;
