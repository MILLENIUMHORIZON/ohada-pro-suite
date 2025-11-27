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

    // Get invoice with dgi_uid and all details
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select('id, dgi_uid, number, total_ttc, total_ht, currency')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.dgi_uid) {
      throw new Error('Cette facture n\'a pas encore été envoyée à la DGI');
    }

    console.log('Confirming invoice with UID:', invoice.dgi_uid);

    // Prepare the body for DGI CONFIRM endpoint
    // IMPORTANT: Must match the mode used in initial send (mode: 'ht')
    // Round to 2 decimals to avoid precision issues
    const totalHT = Math.round((invoice.total_ht || 0) * 100) / 100;
    
    const confirmBody = {
      total: totalHT,  // Montant HT (must match initial send mode)
      vtotal: 0.00,
      curCode: invoice.currency || 'CDF',
      curRate: 1
    };

    console.log('Sending to DGI CONFIRM:', JSON.stringify(confirmBody, null, 2));
    console.log('Invoice totals - HT:', totalHT, 'TTC:', invoice.total_ttc);

    // Call DGI CONFIRM endpoint
    const dgiResponse = await fetch(
      `https://developper.dgirdc.cd/edef/api/invoice/${invoice.dgi_uid}/CONFIRM`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6IkEyMTYxNTk5RXxDRDAxMDAyOTIzLTEiLCJyb2xlIjoiVGF4cGF5ZXIiLCJuYmYiOjE3NjQxNDk2NzgsImV4cCI6MTc2NDI4NDQwMCwiaWF0IjoxNzY0MTQ5Njc4LCJpc3MiOiJkZXZlbG9wcGVyLmRnaXJkYy5jZCIsImF1ZCI6ImRldmVsb3BwZXIuZGdpcmRjLmNkIn0.Ttu-lWJKWNlrLXmPQ9im7tbKtpQq3QcsNfcP5gCieB4',
        },
        body: JSON.stringify(confirmBody)
      }
    );

    if (!dgiResponse.ok) {
      const errorText = await dgiResponse.text();
      console.error('DGI CONFIRM API error:', errorText);
      throw new Error(`Erreur DGI: ${dgiResponse.status} - ${errorText}`);
    }

    const dgiResult = await dgiResponse.json();
    console.log('DGI CONFIRM response:', JSON.stringify(dgiResult, null, 2));
    console.log('Response keys:', Object.keys(dgiResult));

    // Check if DGI returned an error
    if (dgiResult.errorCode || dgiResult.error_code || dgiResult.error) {
      const errorCode = dgiResult.errorCode || dgiResult.error_code;
      const errorDesc = dgiResult.errorDesc || dgiResult.error_desc || dgiResult.errorMessage || dgiResult.message || 'Erreur inconnue';
      console.error('DGI returned error:', { errorCode, errorDesc });
      throw new Error(`Erreur DGI (${errorCode}): ${errorDesc}`);
    }

    // Try to extract QR code from various possible locations in response
    let qrCode = null;
    
    // Check common field names
    const possibleFields = [
      'qrCode', 'qrcode', 'qr_code', 'QRCode', 'QRCODE', 'QR_CODE',
      'qr', 'QR', 'code', 'Code', 'qrCodeImage', 'qrCodeData',
      'base64QrCode', 'qrCodeBase64', 'imageBase64', 'image'
    ];
    
    for (const field of possibleFields) {
      if (dgiResult[field]) {
        qrCode = dgiResult[field];
        console.log(`QR code found in field: ${field}`);
        break;
      }
    }
    
    // Check nested data object
    if (!qrCode && dgiResult.data) {
      console.log('Checking data object:', JSON.stringify(dgiResult.data, null, 2));
      for (const field of possibleFields) {
        if (dgiResult.data[field]) {
          qrCode = dgiResult.data[field];
          console.log(`QR code found in data.${field}`);
          break;
        }
      }
    }
    
    // Check result object
    if (!qrCode && dgiResult.result) {
      console.log('Checking result object:', JSON.stringify(dgiResult.result, null, 2));
      for (const field of possibleFields) {
        if (dgiResult.result[field]) {
          qrCode = dgiResult.result[field];
          console.log(`QR code found in result.${field}`);
          break;
        }
      }
    }

    if (!qrCode) {
      console.error('No QR code found in response structure:', JSON.stringify(dgiResult, null, 2));
      throw new Error('Le QR code n\'a pas été retourné par la DGI. Veuillez vérifier que la facture a bien été envoyée à la DGI au préalable.');
    }
    
    console.log('QR code extracted successfully (length):', qrCode.length);

    // Update invoice with QR code and full normalization data
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update({ 
        dgi_qrcode: qrCode,
        dgi_normalization_data: dgiResult, // Store complete DGI response
        status: 'posted' // Mark as posted when normalized
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Error updating invoice with QR code:', updateError);
      throw new Error('Erreur lors de la sauvegarde du QR code');
    }

    console.log('Invoice updated successfully with QR code and normalization data');

    return new Response(
      JSON.stringify({
        success: true,
        qrCode: qrCode,
        normalizationData: dgiResult,
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
