import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfirmInvoiceData {
  invoiceId: string;
}

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

    const { invoiceId } = await req.json() as ConfirmInvoiceData;

    console.log('Confirming invoice with DGI:', invoiceId);

    // Get invoice with dgi_uid
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select('id, dgi_uid, number')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.dgi_uid) {
      throw new Error('Cette facture n\'a pas encore été envoyée à la DGI');
    }

    console.log('Confirming invoice with UID:', invoice.dgi_uid);

    // Call DGI CONFIRM endpoint
    const dgiResponse = await fetch(
      `https://developper.dgirdc.cd/edef/api/invoice/${invoice.dgi_uid}/CONFIRM`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6IkEyMTYxNTk5RXxDRDAxMDAyOTIzLTEiLCJyb2xlIjoiVGF4cGF5ZXIiLCJuYmYiOjE3NjQxNDk2NzgsImV4cCI6MTc2NDI4NDQwMCwiaWF0IjoxNzY0MTQ5Njc4LCJpc3MiOiJkZXZlbG9wcGVyLmRnaXJkYy5jZCIsImF1ZCI6ImRldmVsb3BwZXIuZGdpcmRjLmNkIn0.Ttu-lWJKWNlrLXmPQ9im7tbKtpQq3QcsNfcP5gCieB4',
        },
        body: JSON.stringify({})
      }
    );

    if (!dgiResponse.ok) {
      const errorText = await dgiResponse.text();
      console.error('DGI CONFIRM API error:', errorText);
      throw new Error(`Erreur DGI: ${dgiResponse.status} - ${errorText}`);
    }

    const dgiResult = await dgiResponse.json();
    console.log('DGI CONFIRM response:', dgiResult);

    // Extract QR code from response (assuming it's in a field like qrCode or qrcode)
    const qrCode = dgiResult.qrCode || dgiResult.qrcode || dgiResult.qr_code;

    if (!qrCode) {
      console.error('No QR code in response:', dgiResult);
      throw new Error('Le QR code n\'a pas été retourné par la DGI');
    }

    // Update invoice with QR code
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update({ 
        dgi_qrcode: qrCode,
        status: 'posted' // Mark as posted when normalized
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Error updating invoice with QR code:', updateError);
      throw new Error('Erreur lors de la sauvegarde du QR code');
    }

    return new Response(
      JSON.stringify({
        success: true,
        qrCode: qrCode,
        message: 'Facture normalisée avec succès',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error confirming invoice with DGI:', error);
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
