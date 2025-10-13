/*
  # Allow Public Access to Active Zones

  1. Changes
    - Add RLS policy to allow public (anon) users to read active zones
    - Zones are geographic boundaries and safe to expose publicly
    - Keeps existing authenticated user policy for compatibility

  2. Security
    - Only SELECT access granted
    - Only active zones (is_active = true) are readable
    - No write permissions for public users
*/

-- Drop existing policy for authenticated users and recreate with anon role included
DROP POLICY IF EXISTS "Public can read active zones" ON zones;

-- Create policy that allows both authenticated and anonymous users to read active zones
CREATE POLICY "Public can read active zones"
  ON zones
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);
