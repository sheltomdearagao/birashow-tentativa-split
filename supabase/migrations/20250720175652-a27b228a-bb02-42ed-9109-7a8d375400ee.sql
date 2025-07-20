-- Tabela para armazenar states do OAuth temporariamente
CREATE TABLE public.mp_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.mp_oauth_states ENABLE ROW LEVEL SECURITY;

-- Política RLS para states
CREATE POLICY "Usuários podem gerenciar seus próprios states"
ON public.mp_oauth_states FOR ALL
USING (auth.uid() = user_id);

-- Índice para performance
CREATE INDEX idx_mp_oauth_states_user_id ON public.mp_oauth_states(user_id);
CREATE INDEX idx_mp_oauth_states_expires_at ON public.mp_oauth_states(expires_at);

-- Storage bucket para imagens de produtos
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Políticas de storage para imagens de produtos
CREATE POLICY "Imagens de produtos são visíveis publicamente"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Vendedores podem fazer upload de imagens"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Vendedores podem atualizar suas imagens"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Vendedores podem deletar suas imagens"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' AND
  auth.role() = 'authenticated'
);