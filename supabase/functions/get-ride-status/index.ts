const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const rideId = url.searchParams.get('rideId');

    if (!rideId) {
      return new Response(
        JSON.stringify({ error: 'Ride ID is required', data: null }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('🔍 Fetching ride status for:', rideId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ride with driver details
    const { data, error } = await supabase
      .from('rides')
      .select(`
        *,
        drivers:driver_id (
          id,
          user_id,
          rating,
          total_rides,
          users:user_id (
            full_name,
            phone_number
          ),
          vehicles:vehicle_id (
            make,
            model,
            registration_number,
            color,
            vehicle_type
          )
        )
      `)
      .eq('id', rideId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching ride:', error);
      throw error;
    }

    console.log('✅ Ride status:', data?.status, 'Driver assigned:', !!data?.driver_id);

    return new Response(
      JSON.stringify({ data, error: null }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred', data: null }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});
