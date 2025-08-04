-- Criar tabela de vendedores primeiro
CREATE TABLE public.sellers (
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

-- Criar foreign key para sellers
ALTER TABLE public.sellers 
ADD CONSTRAINT sellers_profile_id_fkey 
FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;