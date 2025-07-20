-- Criação das tabelas para o sistema de barbearia

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de serviços oferecidos
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de agendamentos
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  booking_type TEXT DEFAULT 'app' NOT NULL CHECK (booking_type IN ('app', 'manual')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de fila de atendimento do dia
CREATE TABLE public.daily_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
  queue_position INTEGER NOT NULL,
  queue_date DATE DEFAULT CURRENT_DATE NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Inserir serviços padrão baseados nas imagens
INSERT INTO public.services (name, price, duration_minutes, description) VALUES
('Corte à Máquina', 20.00, 30, 'Corte tradicional com máquina'),
('Corte à Tesoura', 25.00, 45, 'Corte detalhado com tesoura'),
('Barba', 20.00, 20, 'Fazer e modelar a barba'),
('Corte + Barba', 35.00, 60, 'Corte completo com barba'),
('Sobrancelha', 20.00, 15, 'Modelagem de sobrancelha'),
('Pacote Completo', 55.00, 90, 'Corte, barba e cuidados pessoais');

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver e editar seu próprio perfil"
ON public.profiles FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Serviços são visíveis para todos usuários autenticados"
ON public.services FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários podem ver e gerenciar seus próprios agendamentos"
ON public.appointments FOR ALL
USING (customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Fila é visível para todos usuários autenticados"
ON public.daily_queue FOR SELECT
TO authenticated
USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_appointments_customer_id ON public.appointments(customer_id);
CREATE INDEX idx_appointments_service_id ON public.appointments(service_id);
CREATE INDEX idx_appointments_scheduled_time ON public.appointments(scheduled_time);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_daily_queue_date ON public.daily_queue(queue_date);
CREATE INDEX idx_daily_queue_position ON public.daily_queue(queue_position);