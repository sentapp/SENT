-- Legacy CRM stage `asked` was merged into `contacted` in the app.
-- Move existing rows so they appear in the contacted column and pipeline strip rules.

update public.contacts
set status = 'contacted'::public.contact_status
where status::text = 'asked';

