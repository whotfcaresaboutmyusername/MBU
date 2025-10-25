/*
  # Signal-style device key storage

  1. New Tables
    - `user_devices`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `device_label` (text)
      - `identity_key_public` (text, base64)
      - `identity_signing_public` (text, base64)
      - `signed_prekey_public` (text, base64)
      - `signed_prekey_signature` (text, base64)
      - `created_at` (timestamp)
      - `last_seen_at` (timestamp)

    - `device_prekeys`
      - `id` (uuid, primary key)
      - `device_id` (uuid, references user_devices)
      - `prekey_id` (integer)
      - `public_key` (text, base64)
      - `consumed` (boolean)
      - `created_at` (timestamp)

  2. Security & Indexes
    - Enable RLS on both tables
    - Allow authenticated users to read public key material for all devices
    - Allow users to manage their own devices and prekeys
    - Indexes for device lookups and unconsumed prekeys
*/

CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_label text DEFAULT 'primary',
  identity_key_public text NOT NULL,
  identity_signing_public text NOT NULL,
  signed_prekey_public text NOT NULL,
  signed_prekey_signature text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  UNIQUE (user_id, device_label)
);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS device_prekeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
  prekey_id integer NOT NULL,
  public_key text NOT NULL,
  consumed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (device_id, prekey_id)
);

ALTER TABLE device_prekeys ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_device_prekeys_device ON device_prekeys(device_id);
CREATE INDEX IF NOT EXISTS idx_device_prekeys_consumed ON device_prekeys(device_id, consumed) WHERE consumed = false;

-- Policies for user_devices
CREATE POLICY "Public can read device public keys"
  ON user_devices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own devices"
  ON user_devices FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for device_prekeys
CREATE POLICY "Public can read published prekeys"
  ON device_prekeys FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users manage their own prekeys"
  ON device_prekeys FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_devices ud
      WHERE ud.id = device_prekeys.device_id
      AND ud.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_devices ud
      WHERE ud.id = device_prekeys.device_id
      AND ud.user_id = auth.uid()
    )
  );
