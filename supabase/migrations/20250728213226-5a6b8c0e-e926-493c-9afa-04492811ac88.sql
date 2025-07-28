-- Adicionar campo queue_position na tabela appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS queue_position integer;

-- Adicionar campo time_slot na tabela appointments para manter referência ao turno
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time_slot text;

-- Atualizar appointments existentes para ter time_slot baseado no horário
UPDATE appointments 
SET time_slot = CASE 
  WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 10 THEN 'morning'
  WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 14 THEN 'afternoon' 
  WHEN EXTRACT(hour FROM scheduled_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = 18 THEN 'evening'
  ELSE 'morning'
END
WHERE time_slot IS NULL;

-- Atualizar queue_position para appointments existentes
UPDATE appointments 
SET queue_position = sub.row_num
FROM (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY scheduled_time::date, time_slot
           ORDER BY created_at
         ) as row_num
  FROM appointments
  WHERE status = 'scheduled' AND queue_position IS NULL
) sub
WHERE appointments.id = sub.id;