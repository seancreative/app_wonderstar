import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendOTPRequest {
  phone: string;
}

interface ISMSResponse {
  error?: string;
  success?: boolean;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendSMSviaISMS(phoneNumber: string, message: string): Promise<ISMSResponse> {
  const url = 'https://ww3.isms.com.my/isms_send_all_id.php';

  const ismsUsername = Deno.env.get('ISMS_USERNAME') || 'fitricrave';
  const ismsPassword = Deno.env.get('ISMS_PASSWORD') || 'Api@Integration2024!';
  const ismsSenderId = Deno.env.get('ISMS_SENDER_ID') || '63001';

  console.log('[send-otp-sms] Sending SMS to:', phoneNumber);
  console.log('[send-otp-sms] Using sender ID:', ismsSenderId);

  const formData = new URLSearchParams({
    un: ismsUsername,
    pwd: ismsPassword,
    dstno: phoneNumber,
    msg: message,
    type: '1',
    agreedterm: 'YES',
    sendid: ismsSenderId
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const text = await response.text();
    console.log('[send-otp-sms] SMS API Response:', text);
    console.log('[send-otp-sms] SMS API Status:', response.status);

    if (text.includes('2000') || text.includes('success')) {
      console.log('[send-otp-sms] SMS sent successfully');
      return { success: true };
    } else {
      console.error('[send-otp-sms] SMS send failed:', text);
      return { error: `SMS send failed: ${text}`, success: false };
    }
  } catch (error: any) {
    console.error('[send-otp-sms] SMS API error:', error);
    return { error: `SMS API error: ${error.message}`, success: false };
  }
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

    console.log('[send-otp-sms] Function invoked');
    console.log('[send-otp-sms] Supabase URL configured:', !!supabaseUrl);
    console.log('[send-otp-sms] Service role key configured:', !!supabaseKey);

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone }: SendOTPRequest = await req.json();
    console.log('[send-otp-sms] Received phone number:', phone);

    if (!phone || !phone.startsWith('+60')) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number. Must start with +60' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingVerification, error: fetchError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[send-otp-sms] Database fetch error:', fetchError);
      throw fetchError;
    }

    console.log('[send-otp-sms] Existing verification found:', !!existingVerification);

    const now = new Date();
    let sentCount = 0;

    if (existingVerification) {
      const lastSent = existingVerification.last_sent_at
        ? new Date(existingVerification.last_sent_at)
        : null;

      if (lastSent) {
        const hoursSinceLastSend = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastSend < 1) {
          sentCount = existingVerification.sent_count || 0;
          if (sentCount >= 3) {
            return new Response(
              JSON.stringify({
                error: 'Rate limit exceeded. Maximum 3 SMS per hour. Please try again later.',
                remainingTime: Math.ceil((1 - hoursSinceLastSend) * 60)
              }),
              {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        } else {
          sentCount = 0;
        }
      }
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const message = `Your WonderStars verification code is: ${otpCode}. Valid for 5 minutes. Do not share this code.`;

    const smsResult = await sendSMSviaISMS(phone, message);

    if (!smsResult.success) {
      return new Response(
        JSON.stringify({ error: smsResult.error || 'Failed to send SMS' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: upsertError } = await supabase
      .from('phone_verifications')
      .upsert({
        phone,
        verification_code: otpCode,
        expires_at: expiresAt.toISOString(),
        sent_count: sentCount + 1,
        last_sent_at: now.toISOString(),
        verified: false,
        verified_at: null
      }, {
        onConflict: 'phone'
      });

    if (upsertError) {
      console.error('[send-otp-sms] Database upsert error:', upsertError);
      throw upsertError;
    }

    console.log('[send-otp-sms] Verification record saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification code sent successfully',
        expiresIn: 300
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-otp-sms:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});