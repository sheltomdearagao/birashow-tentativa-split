-- Adicionar novo status 'pending_payment' para appointments
-- Permitir que agendamentos fiquem pendentes até confirmação de pagamento

-- Alterar a constraint de status se existir
ALTER TABLE public.appointments 
DROP CONSTRAINT IF EXISTS appointments_status_check;

-- Adicionar nova constraint com o status pending_payment
ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('scheduled', 'completed', 'cancelled', 'pending_payment'));

-- Atualizar a coluna status para ter pending_payment como possível valor
COMMENT ON COLUMN public.appointments.status IS 'Status do agendamento: scheduled, completed, cancelled, pending_payment';