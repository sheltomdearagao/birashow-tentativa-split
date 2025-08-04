-- Criar tabelas que estão faltando nas edge functions

-- Tabela para estados OAuth (se não existir)
CREATE TABLE IF NOT EXISTS public.mp_oauth_states (
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

-- Tabela para vendedores (se não existir)
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    business_name TEXT NOT NULL,
    mp_user_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de vendedores
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- Políticas para vendedores
CREATE POLICY "Users can view all sellers" 
ON public.sellers 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own seller profile" 
ON public.sellers 
FOR ALL 
USING (auth.uid() = user_id);

-- Adicionar trigger de timestamp para vendedores
CREATE TRIGGER update_sellers_updated_at
BEFORE UPDATE ON public.sellers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para pedidos (orders) - se não existir completamente
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    total_amount NUMERIC NOT NULL,
    marketplace_fee NUMERIC DEFAULT 0,
    mp_application_fee NUMERIC DEFAULT 0,
    mp_preference_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de pedidos
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Políticas para pedidos
CREATE POLICY "Users can view their own orders as buyer" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = buyer_id);

CREATE POLICY "Users can view their orders as seller" 
ON public.orders 
FOR SELECT 
USING (auth.uid() IN (SELECT user_id FROM sellers WHERE id = seller_id));

CREATE POLICY "Users can create orders as buyer" 
ON public.orders 
FOR INSERT 
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Authenticated users can update orders" 
ON public.orders 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Adicionar trigger de timestamp para pedidos
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para itens de pedidos
CREATE TABLE IF NOT EXISTS public.order_items (
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

-- Corrigir a tabela split_payments para ter seller_id relacionado corretamente
ALTER TABLE public.split_payments 
ADD COLUMN IF NOT EXISTS order_id UUID,
ADD COLUMN IF NOT EXISTS mp_collector_id TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Atualizar a política para split_payments baseada em orders
DROP POLICY IF EXISTS "Users can view their own split payments" ON public.split_payments;

CREATE POLICY "Users can view their split payments as seller" 
ON public.split_payments 
FOR SELECT 
USING (
    seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
    OR 
    order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid())
);

-- Adicionar foreign keys se não existirem
DO $$ 
BEGIN
    -- Foreign key para mp_oauth_states -> sellers
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'mp_oauth_tokens_seller_id_fkey'
    ) THEN
        ALTER TABLE public.mp_oauth_tokens 
        ADD CONSTRAINT mp_oauth_tokens_seller_id_fkey 
        FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;
    END IF;

    -- Foreign key para sellers -> profiles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sellers_profile_id_fkey'
    ) THEN
        ALTER TABLE public.sellers 
        ADD CONSTRAINT sellers_profile_id_fkey 
        FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- Foreign key para orders -> profiles (buyer)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_buyer_id_fkey'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_buyer_id_fkey 
        FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- Foreign key para orders -> sellers
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_seller_id_fkey'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT orders_seller_id_fkey 
        FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;
    END IF;

    -- Foreign key para order_items -> orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'order_items_order_id_fkey'
    ) THEN
        ALTER TABLE public.order_items 
        ADD CONSTRAINT order_items_order_id_fkey 
        FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;

    -- Foreign key para order_items -> products
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'order_items_product_id_fkey'
    ) THEN
        ALTER TABLE public.order_items 
        ADD CONSTRAINT order_items_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
    END IF;

    -- Foreign key para split_payments -> orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'split_payments_order_id_fkey'
    ) THEN
        ALTER TABLE public.split_payments 
        ADD CONSTRAINT split_payments_order_id_fkey 
        FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;

    -- Foreign key para split_payments -> sellers
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'split_payments_seller_id_fkey'
    ) THEN
        ALTER TABLE public.split_payments 
        ADD CONSTRAINT split_payments_seller_id_fkey 
        FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;
    END IF;
END $$;