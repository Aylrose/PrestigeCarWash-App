ALTER TABLE prestige_feedback
ADD COLUMN IF NOT EXISTS sync_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prestige_feedback_sync_id
ON prestige_feedback(sync_id)
WHERE sync_id IS NOT NULL;