alter table public.contacts add column if not exists is_one_time_donor boolean not null default false;
alter table public.contacts add column if not exists one_time_donation_amount numeric(12, 2) not null default 0;
alter table public.contacts add column if not exists one_time_donation_date date;
