-- Fix appointments status check to allow pending payments and other states
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled','pending_payment','paid','canceled','completed'));

-- Optional safety: keep an index on status for performance
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments (status);