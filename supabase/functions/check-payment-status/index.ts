import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { uuid } = await req.json();

    if (!uuid) {
      throw new Error('UUID is required');
    }

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid user');
    }

    console.log('Checking payment status for UUID:', uuid);

    // Check payment status from external API
    const checkUrl = `https://testled.milleniumhorizon.com/check_paie.php?uuid=${encodeURIComponent(uuid)}`;
    console.log('Calling:', checkUrl);
    
    const response = await fetch(checkUrl);
    const paymentData = await response.json();
    
    console.log('Payment data received:', paymentData);

    // Check flexpay_raw status (0 = success, other = failed/pending)
    const isPaid = paymentData.flexpay_raw?.status === 0;
    const newStatus = isPaid ? 'completed' : 'pending';

    console.log('Payment status:', { isPaid, newStatus, rawStatus: paymentData.flexpay_raw?.status });

    // Update payment attempt status in database
    const { error: updateError } = await supabase
      .from('payment_attempts')
      .update({ 
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('uuid', uuid)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating payment status:', updateError);
      throw updateError;
    }

    // If payment is successful, create activation key
    if (isPaid) {
      console.log('Payment successful, creating activation key');
      
      // Get payment attempt details
      const { data: paymentAttempt, error: fetchError } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('uuid', uuid)
        .single();

      if (fetchError || !paymentAttempt) {
        throw new Error('Payment attempt not found');
      }

      // Generate activation key
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const segments = 4;
      const segmentLength = 5;
      
      const key = Array.from({ length: segments }, () =>
        Array.from({ length: segmentLength }, () =>
          chars.charAt(Math.floor(Math.random() * chars.length))
        ).join("")
      ).join("-");

      // Calculate expiration date
      let expiresAt = null;
      if (paymentAttempt.duration_type === 'monthly') {
        const months = paymentAttempt.duration;
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + months);
        expiresAt = expirationDate.toISOString();
      } else {
        // Annual
        const years = paymentAttempt.duration;
        const expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + years);
        expiresAt = expirationDate.toISOString();
      }

      // Create activation key linked to the company
      const { error: keyError } = await supabase
        .from('activation_keys')
        .insert({
          key,
          key_type: paymentAttempt.key_type,
          max_uses: paymentAttempt.number_of_users,
          current_uses: 0,
          expires_at: expiresAt,
          is_active: true,
          created_by: user.id,
          company_id: paymentAttempt.company_id
        });

      if (keyError) {
        console.error('Error creating activation key:', keyError);
        throw keyError;
      }

      console.log('Activation key created:', key);

      return new Response(
        JSON.stringify({ 
          status: newStatus,
          isPaid: true,
          activationKey: key,
          paymentData 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        status: newStatus,
        isPaid: false,
        paymentData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error checking payment status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
