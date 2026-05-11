-- Expand CRM pipeline statuses (labels align with app Status dropdown).

alter type public.contact_status add value if not exists 'contacted';
alter type public.contact_status add value if not exists 'meeting_scheduled';
alter type public.contact_status add value if not exists 'committed';

-- Legacy value used before this migration
update public.contacts
set status = 'contacted'::public.contact_status
where status = 'followup'::public.contact_status;
