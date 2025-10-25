/*
  # Extend messages for Signal envelopes

  1. Changes
    - Add a nullable `ciphertext` column to store Signal envelopes
    - Add a nullable `signal_metadata` JSONB column for handshake hints
    - Create partial index for quick lookup of encrypted rows

  2. Security
    - Existing RLS policies remain valid
*/

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS ciphertext text,
  ADD COLUMN IF NOT EXISTS signal_metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_ciphertext_not_null
  ON messages(id)
  WHERE ciphertext IS NOT NULL;
