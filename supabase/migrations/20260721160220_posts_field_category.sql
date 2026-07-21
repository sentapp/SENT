-- Field category for community post filtering.

alter table public.posts add column if not exists field_category text;
