import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from auth
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get DGI API token from secrets
    const dgiApiToken = Deno.env.get('DGI_API_TOKEN');
    if (!dgiApiToken) {
      throw new Error('DGI_API_TOKEN not configured');
    }

    console.log('Testing DGI API status with token...');

    // Test DGI API status
    const dgiResponse = await fetch('https://developper.dgirdc.cd/edef/api/info/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dgiApiToken}`,
      },
    });

    const responseText = await dgiResponse.text();
    console.log('DGI Status Response:', dgiResponse.status, responseText);

    if (!dgiResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          status: dgiResponse.status,
          message: 'Token invalide ou expiré',
          details: responseText,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: dgiResponse.status,
        message: 'Token valide',
        data: responseData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error checking DGI status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
