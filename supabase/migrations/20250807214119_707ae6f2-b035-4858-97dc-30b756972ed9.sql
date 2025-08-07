-- Add missing columns used by appointments flow
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS time_slot text,
  ADD COLUMN IF NOT EXISTS queue_position integer;

-- Helpful indexes for queries used in UI and webhooks
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_time ON public.appointments (scheduled_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_time_slot ON public.appointments (time_slot);

-- Table to ensure idempotent processing of webhooks
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Secure the webhook events table; service role bypasses RLS
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;