-- Add "supporter" to contact_category (monthly givers in CRM — distinct from app role).

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'contact_category'
      and e.enumlabel = 'supporter'
  ) then
    alter type public.contact_category add value 'supporter';
  end if;
end$$;
