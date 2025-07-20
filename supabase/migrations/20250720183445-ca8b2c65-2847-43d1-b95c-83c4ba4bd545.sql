-- Adicionar políticas de INSERT, UPDATE e DELETE para daily_queue
-- Permitir que usuários autenticados insiram na fila quando fazem agendamentos

CREATE POLICY "Usuários autenticados podem adicionar à fila" 
ON public.daily_queue 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar fila" 
ON public.daily_queue 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem remover da fila" 
ON public.daily_queue 
FOR DELETE 
USING (auth.uid() IS NOT NULL);