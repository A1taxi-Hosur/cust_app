/*
  # Create function to initialize driver location when ride is accepted
  
  1. New Functions
    - `initialize_driver_location()` - Automatically creates a driver_locations record when a ride is accepted
    - Uses pickup location as initial driver location if no location exists
  
  2. Trigger
    - Triggers on rides table UPDATE when status changes to 'accepted'
    - Only creates location if driver doesn't already have one
  
  3. Notes
    - Ensures drivers always have a location record when assigned to rides
    - Uses pickup location as a reasonable default (driver is presumably nearby)
    - Won't override existing location data
*/

-- Create function to initialize driver location when ride is accepted
CREATE OR REPLACE FUNCTION initialize_driver_location()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'accepted' and driver is assigned
  IF NEW.status = 'accepted' AND NEW.driver_id IS NOT NULL THEN
    -- Check if driver location already exists
    IF NOT EXISTS (
      SELECT 1 FROM driver_locations WHERE driver_id = NEW.driver_id
    ) THEN
      -- Create initial location near pickup point
      INSERT INTO driver_locations (
        driver_id,
        latitude,
        longitude,
        heading,
        speed,
        accuracy,
        updated_at,
        created_at
      ) VALUES (
        NEW.driver_id,
        NEW.pickup_latitude,
        NEW.pickup_longitude,
        0.00, -- Default heading
        0.00, -- Default speed (stationary)
        50.00, -- Default accuracy (50m)
        now(),
        now()
      )
      ON CONFLICT (driver_id) DO NOTHING;
      
      RAISE NOTICE 'Initialized location for driver %', NEW.driver_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on rides table
DROP TRIGGER IF EXISTS trigger_initialize_driver_location ON rides;
CREATE TRIGGER trigger_initialize_driver_location
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted')
  EXECUTE FUNCTION initialize_driver_location();

-- Also create a similar trigger for scheduled_bookings when assigned
CREATE OR REPLACE FUNCTION initialize_driver_location_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'assigned' and driver is assigned
  IF NEW.status = 'assigned' AND NEW.assigned_driver_id IS NOT NULL THEN
    -- Check if driver location already exists
    IF NOT EXISTS (
      SELECT 1 FROM driver_locations WHERE driver_id = NEW.assigned_driver_id
    ) THEN
      -- Create initial location near pickup point
      INSERT INTO driver_locations (
        driver_id,
        latitude,
        longitude,
        heading,
        speed,
        accuracy,
        updated_at,
        created_at
      ) VALUES (
        NEW.assigned_driver_id,
        NEW.pickup_latitude,
        NEW.pickup_longitude,
        0.00,
        0.00,
        50.00,
        now(),
        now()
      )
      ON CONFLICT (driver_id) DO NOTHING;
      
      RAISE NOTICE 'Initialized location for driver % from booking', NEW.assigned_driver_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on scheduled_bookings table
DROP TRIGGER IF EXISTS trigger_initialize_driver_location_from_booking ON scheduled_bookings;
CREATE TRIGGER trigger_initialize_driver_location_from_booking
  AFTER UPDATE ON scheduled_bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'assigned')
  EXECUTE FUNCTION initialize_driver_location_from_booking();

COMMENT ON FUNCTION initialize_driver_location() IS 'Automatically creates driver_locations record when ride is accepted, using pickup location as initial position';
COMMENT ON FUNCTION initialize_driver_location_from_booking() IS 'Automatically creates driver_locations record when booking is assigned, using pickup location as initial position';
