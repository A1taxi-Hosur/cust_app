/*
  # Allow customers to read drivers and vehicles data
  
  1. Changes
    - Add RLS policy to allow authenticated and anonymous users to read online verified drivers
    - Add RLS policy to allow reading vehicles data for the map display
  
  2. Security
    - Only SELECT permission granted
    - Only online and verified drivers are visible
    - Read-only access for customers
*/

-- Allow customers and anonymous users to view online verified drivers
DROP POLICY IF EXISTS "Customers can view online verified drivers" ON drivers;

CREATE POLICY "Customers can view online verified drivers"
  ON drivers
  FOR SELECT
  TO authenticated, anon
  USING (status = 'online' AND is_verified = true);

-- Allow customers and anonymous users to view vehicles
DROP POLICY IF EXISTS "Customers can view vehicles" ON vehicles;

CREATE POLICY "Customers can view vehicles"
  ON vehicles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Allow customers and anonymous users to view users (for driver names)
DROP POLICY IF EXISTS "Customers can view driver user profiles" ON users;

CREATE POLICY "Customers can view driver user profiles"
  ON users
  FOR SELECT
  TO authenticated, anon
  USING (
    role = 'driver' AND
    id IN (SELECT user_id FROM drivers WHERE status = 'online' AND is_verified = true)
  );
