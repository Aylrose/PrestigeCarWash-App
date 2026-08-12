
/*
# Create prestige_feedback table

Single-tenant kiosk app — no user accounts, all data is shared/operational.

1. New Tables
- `prestige_feedback`
  - `id` (uuid, primary key)
  - `timestamp` (timestamptz, default now)
  - `accueil` (int2, nullable) — star rating 1-5
  - `lavage` (text, nullable) — impeccable | satisfait | insatisfait
  - `lavage_detail` (text[], nullable) — carrosserie / interieur / jantes
  - `attente` (text, nullable) — rapide | peu_long | trop_long
  - `lounge` (int2, nullable) — star rating 1-5
  - `qualite_prix` (text, nullable) — avantageux | correct | cher
  - `nps` (text, nullable) — oui | non
  - `commentaire` (text, nullable)

2. Security
- RLS enabled.
- anon + authenticated: INSERT (write-once from kiosk), SELECT (for admin dashboard).
- No UPDATE or DELETE (data integrity).
*/

CREATE TABLE IF NOT EXISTS prestige_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  accueil int2,
  lavage text,
  lavage_detail text[],
  attente text,
  lounge int2,
  qualite_prix text,
  nps text,
  commentaire text
);

ALTER TABLE prestige_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_feedback" ON prestige_feedback;
CREATE POLICY "anon_insert_feedback" ON prestige_feedback FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_feedback" ON prestige_feedback;
CREATE POLICY "anon_select_feedback" ON prestige_feedback FOR SELECT
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON prestige_feedback(timestamp DESC);
