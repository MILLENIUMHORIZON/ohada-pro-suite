import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching DGI exchange rate...');
    
    const response = await fetch('https://developper.dgirdc.cd/edef/api/info/currencyRates', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6IkEyMTYxNTk5RXxDRDAxMDAyOTIzLTEiLCJyb2xlIjoiVGF4cGF5ZXIiLCJuYmYiOjE3NjQxNDk2NzgsImV4cCI6MTc2NDI4NDQwMCwiaWF0IjoxNzY0MTQ5Njc4LCJpc3MiOiJkZXZlbG9wcGVyLmRnaXJkYy5jZCIsImF1ZCI6ImRldmVsb3BwZXIuZGdpcmRjLmNkIn0.Ttu-lWJKWNlrLXmPQ9im7tbKtpQq3QcsNfcP5gCieB4',
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
})
