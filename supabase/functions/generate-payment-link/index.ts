import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Clé secrète pour HMAC
const SECRET_KEY = '9f8b7c3a2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, phone } = await req.json();

    // Générer UUID v4 (comme dans le code PHP)
    const uuid = crypto.randomUUID();
    
    const currency = 'USD';
    
    // Créer le payload JSON
    const data = JSON.stringify({
      amount: amount,
      currency: currency,
      uuid: uuid,
      phone: phone
    });

    // Générer le hash HMAC SHA-256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SECRET_KEY);
    const messageData = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hash = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Combiner data + hash et encoder en Base64
    const payload = btoa(data + '::' + hash);

    // Créer l'URL finale
    const paymentUrl = `https://pay.milleniumhorizon.com/?query=${encodeURIComponent(payload)}`;

    console.log('Payment link generated:', { uuid, amount, currency, phone });

    return new Response(
      JSON.stringify({ 
        paymentUrl,
        uuid 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error generating payment link:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
