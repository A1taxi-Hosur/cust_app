import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UpdateLocationRequest {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: UpdateLocationRequest = await req.json();
    const { driverId, latitude, longitude, heading = 0, speed = 0 } = body;

    if (!driverId || latitude === undefined || longitude === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: driverId, latitude, longitude' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('📍 Updating driver location:', {
      driverId,
      latitude,
      longitude,
      heading,
      speed,
    });

    const { data, error } = await supabase
      .from('driver_locations')
      .upsert(
        {
          driver_id: driverId,
          latitude,
          longitude,
          heading,
          speed,
          accuracy: 10,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'driver_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating driver location:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Driver location updated successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Driver location updated successfully',
        location: data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
