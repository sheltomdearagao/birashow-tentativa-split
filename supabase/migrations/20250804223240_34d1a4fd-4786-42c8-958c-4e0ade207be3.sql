-- Corrigir apenas as colunas que faltam na tabela split_payments
ALTER TABLE public.split_payments 
ADD COLUMN IF NOT EXISTS order_id UUID,
ADD COLUMN IF NOT EXISTS mp_collector_id TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Criar constraint para order_id se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'split_payments_order_id_fkey'
    ) THEN
        ALTER TABLE public.split_payments 
        ADD CONSTRAINT split_payments_order_id_fkey 
        FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;
END $$;