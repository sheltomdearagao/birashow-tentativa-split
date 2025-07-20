
-- Adicionar políticas de RLS para processed_webhook_events
CREATE POLICY "Webhooks podem ser processados pelo sistema"
ON public.processed_webhook_events FOR ALL
USING (true);

-- Adicionar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id ON public.processed_webhook_events(event_id);
