-- Criar tabelas restantes do sistema

-- Tabela para tokens OAuth do Mercado Pago
CREATE TABLE public.mp_oauth_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    public_key TEXT,
    mp_user_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de tokens OAuth
ALTER TABLE public.mp_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas para tokens OAuth
CREATE POLICY "Users can manage their own oauth tokens" 
ON public.mp_oauth_tokens 
FOR ALL 
USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));

-- Adicionar trigger de timestamp para tokens OAuth
CREATE TRIGGER update_mp_oauth_tokens_updated_at
BEFORE UPDATE ON public.mp_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Foreign key para mp_oauth_tokens
ALTER TABLE public.mp_oauth_tokens 
ADD CONSTRAINT mp_oauth_tokens_seller_id_fkey 
FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;

-- Tabela para itens de pedidos
CREATE TABLE public.order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de itens de pedidos
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Políticas para itens de pedidos
CREATE POLICY "Users can view order items of their orders" 
ON public.order_items 
FOR SELECT 
USING (
    order_id IN (
        SELECT id FROM orders 
        WHERE buyer_id = auth.uid() 
        OR seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
    )
);

CREATE POLICY "Authenticated users can manage order items" 
ON public.order_items 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Foreign keys para order_items
ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Tabela para estados OAuth
CREATE TABLE public.mp_oauth_states (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    state TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de estados OAuth
ALTER TABLE public.mp_oauth_states ENABLE ROW LEVEL SECURITY;

-- Políticas para estados OAuth
CREATE POLICY "Users can manage their own oauth states" 
ON public.mp_oauth_states 
FOR ALL 
USING (auth.uid() = user_id);

-- Adicionar colunas que faltam na tabela split_payments e a foreign key
ALTER TABLE public.split_payments 
ADD COLUMN IF NOT EXISTS order_id UUID,
ADD COLUMN IF NOT EXISTS mp_collector_id TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Foreign key para split_payments -> orders
ALTER TABLE public.split_payments 
ADD CONSTRAINT split_payments_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;