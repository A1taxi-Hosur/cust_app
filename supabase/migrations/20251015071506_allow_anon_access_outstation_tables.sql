/*
  # Allow anonymous access to outstation fare tables

  1. Changes
    - Drop existing restrictive policies for outstation_packages and outstation_fares
    - Create new policies that allow both authenticated AND anonymous users to read active data
    - This enables fare calculation on the client side before authentication
  
  2. Security
    - Read-only access for both authenticated and anonymous users
    - Only active records (is_active = true) are visible
    - Admin write access remains unchanged
*/

-- Drop existing restrictive read policies
DROP POLICY IF EXISTS "Public can read active outstation packages" ON outstation_packages;
DROP POLICY IF EXISTS "Public can read active outstation fares" ON outstation_fares;

-- Create new policies allowing both authenticated and anonymous access
CREATE POLICY "Anyone can read active outstation packages"
  ON outstation_packages
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Anyone can read active outstation fares"
  ON outstation_fares
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);
