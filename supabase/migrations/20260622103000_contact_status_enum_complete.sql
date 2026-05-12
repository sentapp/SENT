-- Idempotent enum completion for CRM `contact_status` (PostgreSQL 15+).
-- Core schema created: prospect, asked, followup, partner, declined.
-- 20260612100000 added: contacted, meeting_scheduled, committed (and migrated followup → contacted).
-- This migration re-runs ADD VALUE IF NOT EXISTS for every app-facing value so fresh/partial DBs match the client.

alter type public.contact_status add value if not exists 'prospect';
alter type public.contact_status add value if not exists 'asked';
alter type public.contact_status add value if not exists 'partner';
alter type public.contact_status add value if not exists 'declined';
alter type public.contact_status add value if not exists 'contacted';
alter type public.contact_status add value if not exists 'meeting_scheduled';
alter type public.contact_status add value if not exists 'committed';
