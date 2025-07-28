-- Adicionar campo queue_position na tabela appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS queue_position integer;

-- Adicionar campo time_slot na tabela appointments para manter referência ao turno
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time_slot text;

-- Criar índice para consultas de posição por turno e data
CREATE INDEX IF NOT EXISTS idx_appointments_queue_position 
ON appointments(scheduled_time::date, time_slot, queue_position);

-- Atualizar appointments existentes para ter posições baseadas na ordem de criação por turno
UPDATE appointments 
SET queue_position = sub.row_num,
    time_slot = CASE 
      WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 10 THEN 'morning'
      WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 14 THEN 'afternoon' 
      WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 18 THEN 'evening'
      ELSE 'morning'
    END
FROM (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY scheduled_time::date, 
           CASE 
             WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 10 THEN 'morning'
             WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 14 THEN 'afternoon' 
             WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 18 THEN 'evening'
             ELSE 'morning'
           END
           ORDER BY created_at
         ) as row_num
  FROM appointments
  WHERE status = 'scheduled'
) sub
WHERE appointments.id = sub.id;