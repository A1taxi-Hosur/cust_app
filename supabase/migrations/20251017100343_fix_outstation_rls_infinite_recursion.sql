/*
  # Fix RLS infinite recursion for outstation tables
  
  1. Problem
    - Admin policies on outstation_packages and outstation_fares reference users table
    - Users table policies reference drivers table  
    - Drivers table policies reference users table back
    - This creates infinite recursion: outstation → users → drivers → users
  
  2. Solution
    - Drop admin policies that cause recursion
    - Keep anonymous/authenticated read policies (these work fine)
    - Use service_role for admin operations instead of RLS policies
  
  3. Impact
    - Anonymous users can still read active outstation data ✅
    - No more infinite recursion errors ✅
    - Admin operations handled via service_role (backend/edge functions)
*/

-- Drop the problematic admin policies that reference users table
DROP POLICY IF EXISTS "Admins can manage all outstation packages" ON outstation_packages;
DROP POLICY IF EXISTS "Admins can manage all outstation fares" ON outstation_fares;

-- The "Anyone can read" policies remain and work perfectly:
-- "Anyone can read active outstation packages" - allows anon/authenticated SELECT
-- "Anyone can read active outstation fares" - allows anon/authenticated SELECT
