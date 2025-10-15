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
    console.log('\ud83d\udd10 ===== VERIFY OTP STARTING =====');
    const { phoneNumber, otp } = await req.json();
    console.log('\ud83d\udd10 Phone Number:', phoneNumber);
    console.log('\ud83d\udd10 OTP:', otp);

    if (!phoneNumber || !otp) {
      console.log('\u274c Missing phone number or OTP');
      return new Response(
        JSON.stringify({ error: 'Phone number and OTP are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('\ud83d\udd10 Supabase client created');

    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('otp_code', otp)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      console.error('OTP verification failed:', otpError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    await supabase
      .from('otp_verifications')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    console.log('\ud83d\udd10 Checking for existing customer...');
    const { data: existingCustomer } = await supabase
      .from('Customers')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    let customerId: string;
    let userId: string | null = null;

    if (existingCustomer) {
      console.log('\u2705 Found existing customer:', existingCustomer.id);
      customerId = existingCustomer.id.toString();
      userId = existingCustomer.user_id;

      console.log('\ud83d\udd10 Updating existing customer name...');
      await supabase
        .from('Customers')
        .update({
          name: otpRecord.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id);
    } else {
      console.log('\ud83d\udd10 Creating new customer...');
      const { data: newCustomer, error: customerError } = await supabase
        .from('Customers')
        .insert({
          name: otpRecord.name,
          phone_number: phoneNumber,
        })
        .select()
        .single();

      if (customerError || !newCustomer) {
        console.error('\u274c Error creating customer:', customerError);
        console.error('\u274c Customer error details:', JSON.stringify(customerError, null, 2));
        return new Response(
          JSON.stringify({ error: 'Failed to create customer account', details: customerError?.message }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      console.log('\u2705 Customer created:', newCustomer.id);
      customerId = newCustomer.id.toString();
      userId = newCustomer.user_id;
    }

    console.log('\ud83d\udd10 Customer ID:', customerId);
    console.log('\ud83d\udd10 Existing user_id:', userId);

    let authUser;

    if (userId) {
      const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
      if (!getUserError && user) {
        authUser = user;
      }
    }

    if (!authUser) {
      console.log('\ud83d\udd10 Creating new auth user...');
      console.log('\ud83d\udd10 Phone:', phoneNumber);
      console.log('\ud83d\udd10 Name:', otpRecord.name);
      console.log('\ud83d\udd10 Customer ID:', customerId);

      const dummyEmail = `${phoneNumber.replace(/\\+/g, '').replace(/\\s/g, '')}@phone.a1taxi.local`;
      const defaultPassword = `A1Taxi${phoneNumber.replace(/\\D/g, '')}!`;
      console.log('\ud83d\udd10 Using dummy email:', dummyEmail);

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: phoneNumber,
        email: dummyEmail,
        password: defaultPassword,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: otpRecord.name,
          phone_number: phoneNumber,
          customer_id: customerId,
          role: 'customer',
        },
      });

      if (authError) {
        console.error('\u274c Auth error:', authError);
        console.error('\u274c Auth error code:', authError.code);
        console.error('\u274c Auth error message:', authError.message);
        console.error('\u274c Auth error details:', JSON.stringify(authError, null, 2));
        return new Response(
          JSON.stringify({ error: 'Authentication failed: ' + authError.message }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      if (!authData || !authData.user) {
        console.error('\u274c No auth data or user returned');
        return new Response(
          JSON.stringify({ error: 'Failed to create user session' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      authUser = authData.user;
      console.log('\u2705 Auth user created:', authUser.id);

      console.log('\ud83d\udd10 Updating customer with user_id...');
      const { error: updateError } = await supabase
        .from('Customers')
        .update({ user_id: authUser.id })
        .eq('id', customerId);

      if (updateError) {
        console.error('\u274c Error updating customer with user_id:', updateError);
      } else {
        console.log('\u2705 Customer updated with user_id');
      }
    }

    console.log('\u2705 Customer and auth user setup complete');
    console.log('\ud83d\udd10 Generating session for user:', authUser.id);

    // Generate a sign-in link to get the hashed token
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.email!,
      options: {
        redirectTo: 'http://localhost:8081'
      }
    });

    if (linkError || !linkData) {
      console.error('\u274c Error generating session link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate session' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('\u2705 Magic link generated, verifying OTP to get session...');

    // Verify the OTP using the hashed token to get a proper session
    const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token
    });

    if (verifyError || !sessionData.session) {
      console.error('\u274c Error verifying OTP for session:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('\u2705 Session created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        customerId,
        userId: authUser.id,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_in: sessionData.session.expires_in,
          expires_at: sessionData.session.expires_at,
          token_type: sessionData.session.token_type,
          user: sessionData.session.user
        },
        user: {
          id: authUser.id,
          email: authUser.email,
          phone: authUser.phone,
          user_metadata: authUser.user_metadata
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Verify OTP error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred during verification' }),
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
