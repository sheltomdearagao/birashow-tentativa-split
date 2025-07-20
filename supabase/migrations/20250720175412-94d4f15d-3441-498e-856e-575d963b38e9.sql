-- Extensões necessárias para criptografia
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de vendedores (sellers)
CREATE TABLE public.sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  mp_user_id bigint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela para tokens OAuth do Mercado Pago (criptografados)
CREATE TABLE public.mp_oauth_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  public_key text,
  mp_user_id bigint NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(seller_id)
);

-- Tabela de produtos
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  category text NOT NULL,
  image_url text,
  stock_quantity integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de pedidos
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric(10,2) NOT NULL,
  marketplace_fee numeric(10,2) NOT NULL DEFAULT 0,
  mp_payment_id bigint,
  mp_preference_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de itens do pedido
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para eventos de webhook processados (idempotência)
CREATE TABLE public.processed_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para sellers
CREATE POLICY "Usuários podem ver e gerenciar seu próprio perfil de vendedor"
ON public.sellers FOR ALL
USING (auth.uid() = user_id);

-- Políticas RLS para tokens OAuth (apenas o próprio vendedor)
CREATE POLICY "Vendedores podem acessar apenas seus próprios tokens"
ON public.mp_oauth_tokens FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sellers 
    WHERE sellers.id = mp_oauth_tokens.seller_id 
    AND sellers.user_id = auth.uid()
  )
);

-- Políticas RLS para produtos
CREATE POLICY "Vendedores podem gerenciar seus próprios produtos"
ON public.products FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sellers 
    WHERE sellers.id = products.seller_id 
    AND sellers.user_id = auth.uid()
  )
);

CREATE POLICY "Produtos ativos são visíveis para todos"
ON public.products FOR SELECT
USING (is_active = true);

-- Políticas RLS para pedidos
CREATE POLICY "Compradores podem ver seus próprios pedidos"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = orders.buyer_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Vendedores podem ver pedidos de seus produtos"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sellers 
    WHERE sellers.id = orders.seller_id 
    AND sellers.user_id = auth.uid()
  )
);

-- Políticas RLS para itens do pedido
CREATE POLICY "Acesso aos itens baseado no acesso ao pedido"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = orders.buyer_id 
        AND profiles.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.sellers 
        WHERE sellers.id = orders.seller_id 
        AND sellers.user_id = auth.uid()
      )
    )
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_sellers_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mp_oauth_tokens_updated_at
  BEFORE UPDATE ON public.mp_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_sellers_user_id ON public.sellers(user_id);
CREATE INDEX idx_products_seller_id ON public.products(seller_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);

-- Função para criptografar tokens
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Usando uma chave derivada da configuração do projeto
  RETURN encode(
    pgp_sym_encrypt(token, current_setting('app.settings.encryption_key', true)),
    'base64'
  );
END;
$$;

-- Função para descriptografar tokens
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    current_setting('app.settings.encryption_key', true)
  );
END;
$$;