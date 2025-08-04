-- Criar tabela orders agora que sellers existe
CREATE TABLE public.orders (
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

-- Criar foreign keys para orders
ALTER TABLE public.orders 
ADD CONSTRAINT orders_buyer_id_fkey 
FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_seller_id_fkey 
FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;