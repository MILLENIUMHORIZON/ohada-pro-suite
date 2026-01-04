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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Create user client with auth
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from auth
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      throw new Error('Token is required');
    }

    console.log('Updating DGI token for user:', user.id);

    // Test the token first
    const testResponse = await fetch('https://developper.dgirdc.cd/edef/api/info/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!testResponse.ok) {
      console.log('Token validation failed:', testResponse.status);
      throw new Error('Le token fourni est invalide ou expiré');
    }

    console.log('Token validated successfully');

    // Get user's company_id
    const { data: profile } = await userClient
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      throw new Error('Company not found');
    }

    console.log('Storing token for company:', profile.company_id);

    // Check if company_settings exists for this company
    const { data: existingSettings } = await supabaseClient
      .from('company_settings')
      .select('id')
      .eq('company_id', profile.company_id)
      .single();

    if (existingSettings) {
      // Update existing settings
      const { error: updateError } = await supabaseClient
        .from('company_settings')
        .update({ dgi_api_token: token, updated_at: new Date().toISOString() })
        .eq('company_id', profile.company_id);

      if (updateError) {
        console.error('Error updating company_settings:', updateError);
        throw new Error('Erreur lors de la sauvegarde du token');
      }
    } else {
      // Insert new settings
      const { error: insertError } = await supabaseClient
        .from('company_settings')
        .insert({ company_id: profile.company_id, dgi_api_token: token });

      if (insertError) {
        console.error('Error inserting company_settings:', insertError);
        throw new Error('Erreur lors de la sauvegarde du token');
      }
    }

    console.log('Token saved successfully for company:', profile.company_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token DGI validé et sauvegardé',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating DGI token:', error);
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
