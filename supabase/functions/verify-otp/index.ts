import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyOTPRequest {
  phone: string;
  code: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[verify-otp] Function invoked');
    console.log('[verify-otp] Supabase URL configured:', !!supabaseUrl);
    console.log('[verify-otp] Service role key configured:', !!supabaseKey);

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone, code }: VerifyOTPRequest = await req.json();
    console.log('[verify-otp] Received phone:', phone);
    console.log('[verify-otp] Code length:', code?.length);

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone number and verification code are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!phone.startsWith('+60')) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number. Must start with +60' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (code.length !== 6 || !/^\d+$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Invalid verification code format. Must be 6 digits' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: verification, error: fetchError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (fetchError) {
      console.error('[verify-otp] Database fetch error:', fetchError);
      throw fetchError;
    }

    console.log('[verify-otp] Verification record found:', !!verification);

    if (!verification) {
      console.log('[verify-otp] No verification record found for phone:', phone);
      return new Response(
        JSON.stringify({ error: 'No verification code found. Please request a new code' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (verification.verified) {
      console.log('[verify-otp] Phone already verified:', phone);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Phone number already verified',
          alreadyVerified: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!verification.verification_code) {
      return new Response(
        JSON.stringify({ error: 'No verification code found. Please request a new code' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const expiresAt = new Date(verification.expires_at);
    const now = new Date();

    console.log('[verify-otp] Current time:', now.toISOString());
    console.log('[verify-otp] Expiry time:', expiresAt.toISOString());
    console.log('[verify-otp] Code expired:', now > expiresAt);

    if (now > expiresAt) {
      await supabase
        .from('phone_verifications')
        .update({
          verification_code: null,
          expires_at: null
        })
        .eq('phone', phone);

      return new Response(
        JSON.stringify({ error: 'Verification code expired. Please request a new code' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (verification.verification_code !== code) {
      console.log('[verify-otp] Invalid code provided');
      console.log('[verify-otp] Expected code length:', verification.verification_code?.length);
      console.log('[verify-otp] Provided code length:', code.length);
      return new Response(
        JSON.stringify({ error: 'Invalid verification code. Please try again' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: updateError } = await supabase
      .from('phone_verifications')
      .update({
        verified: true,
        verified_at: now.toISOString(),
        verification_code: null,
        expires_at: null
      })
      .eq('phone', phone);

    if (updateError) {
      console.error('[verify-otp] Database update error:', updateError);
      throw updateError;
    }

    console.log('[verify-otp] Phone verified successfully:', phone);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Phone number verified successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in verify-otp:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});