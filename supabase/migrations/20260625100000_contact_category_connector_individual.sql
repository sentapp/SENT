-- CRM: add connector + individual to contact_category enum (WHO tags / filters).
alter type public.contact_category add value if not exists 'connector';
alter type public.contact_category add value if not exists 'individual';
