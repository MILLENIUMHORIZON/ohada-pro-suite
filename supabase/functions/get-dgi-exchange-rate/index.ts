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
    console.log('Fetching DGI exchange rate...');

    // Get company_id from request if provided
    let dgiApiToken: string | null = null;
    
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        );

        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: profile } = await userClient
            .from('profiles')
            .select('company_id')
            .eq('user_id', user.id)
            .single();

          if (profile?.company_id) {
            const { data: settings } = await serviceClient
              .from('company_settings')
              .select('dgi_api_token')
              .eq('company_id', profile.company_id)
              .single();

            dgiApiToken = settings?.dgi_api_token || null;
          }
        }
      }
    } catch (e) {
      console.log('Could not get token from company_settings, using fallback');
    }

    if (!dgiApiToken) {
      console.log('No DGI token available, returning fallback rate');
      return new Response(
        JSON.stringify({ 
          error: 'Token DGI non configuré',
          rate: 2800, // Fallback rate
          source: 'Fallback',
          date: new Date().toISOString()
        }),
        { 
          status: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const response = await fetch('https://developper.dgirdc.cd/edef/api/info/currencyRates', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${dgiApiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('DGI API error:', response.status, response.statusText);
      throw new Error(`DGI API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('DGI exchange rate data:', data);

    // Extract USD to CDF rate from the response
    let usdToCdfRate = null;
    let effectiveDate = null;

    // The DGI API returns an array with currency objects
    if (Array.isArray(data)) {
      const usdRate = data.find((item: any) => 
        item.type === 'USD'
      );
      if (usdRate) {
        usdToCdfRate = usdRate.rate;
        effectiveDate = usdRate.date || new Date().toISOString();
      }
    } else if (data.USD) {
      usdToCdfRate = data.USD.rate || data.USD;
      effectiveDate = data.date || new Date().toISOString();
    } else if (data.rate) {
      usdToCdfRate = data.rate;
      effectiveDate = data.date || new Date().toISOString();
    }

    if (!usdToCdfRate) {
      console.error('Could not find USD rate in response:', data);
      throw new Error('USD rate not found in DGI response');
    }

    console.log('USD to CDF rate:', usdToCdfRate, 'Date:', effectiveDate);

    return new Response(
      JSON.stringify({ 
        rate: parseFloat(usdToCdfRate),
        date: effectiveDate,
        source: 'DGI',
        rawData: data
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error in get-dgi-exchange-rate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        rate: 2800, // Fallback rate
        source: 'Fallback',
        date: new Date().toISOString()
      }),
      { 
        status: 200, // Return 200 with fallback
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
