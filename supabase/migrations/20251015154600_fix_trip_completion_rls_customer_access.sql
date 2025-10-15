/*
  # Fix Trip Completion RLS Policy for Customer Access

  1. Changes
    - Drop existing customer RLS policy that checks JWT metadata
    - Create new policy that directly checks auth.uid() against rides.customer_id
    - This allows customers to view trip completions for their rides

  2. Security
    - Maintains data isolation between customers
    - Uses direct customer_id comparison with auth.uid()
    - Allows customers to view their own trip completions only
*/

-- Drop existing customer policy
DROP POLICY IF EXISTS "Customers can view their own trip completions via rides" ON trip_completion;

-- Create new policy using auth.uid() directly
CREATE POLICY "Customers can view their trip completions"
  ON trip_completion
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = trip_completion.ride_id
      AND rides.customer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM scheduled_bookings
      WHERE scheduled_bookings.id = trip_completion.booking_id
      AND scheduled_bookings.customer_id = auth.uid()
    )
  );
