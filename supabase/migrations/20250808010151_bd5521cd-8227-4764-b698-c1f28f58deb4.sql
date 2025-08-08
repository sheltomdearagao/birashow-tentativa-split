-- Add seller_id to services to support multi-vendor routing
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS seller_id uuid;

-- Index for faster filtering by seller
CREATE INDEX IF NOT EXISTS idx_services_seller_id ON public.services (seller_id);

-- Backfill: if there is a single active seller, default all NULLs to that seller's user_id
-- This keeps current behavior working while enabling per-seller split
UPDATE public.services s
SET seller_id = sub.user_id
FROM (
  SELECT user_id
  FROM public.sellers
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1
) sub
WHERE s.seller_id IS NULL;