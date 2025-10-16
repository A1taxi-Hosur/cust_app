/*
  # Allow customers to read driver locations
  
  1. Changes
    - Add RLS policy to allow authenticated users (customers) to read all live locations
    - This enables the customer app to see available drivers on the map
  
  2. Security
    - Only SELECT permission granted
    - Drivers can still only update their own locations
    - Customers can only read, not modify
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Customers can view driver locations" ON live_locations;

-- Allow customers to view all driver locations for the map
CREATE POLICY "Customers can view driver locations"
  ON live_locations
  FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anonymous users (before login) to see drivers
DROP POLICY IF EXISTS "Anonymous users can view driver locations" ON live_locations;

CREATE POLICY "Anonymous users can view driver locations"
  ON live_locations
  FOR SELECT
  TO anon
  USING (true);
