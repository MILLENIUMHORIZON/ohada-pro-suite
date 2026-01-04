import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceData {
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

    const { invoiceId } = await req.json() as InvoiceData;

    console.log('Sending invoice to DGI:', invoiceId);

    // Get invoice with all related data
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select(`
        *,
        partner:partners!inner(*),
        lines:invoice_lines!inner(
          *,
          product:products!inner(*),
          tax:taxes(*)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Get company data
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id, full_name')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    const { data: company } = await supabaseClient
      .from('companies')
      .select('nif, nim, currency')
      .eq('id', profile.company_id)
      .single();

    // Validate required company information
    if (!company?.nif || !company?.nim) {
      throw new Error('Les informations fiscales de l\'entreprise (NIF et NIM) doivent être renseignées dans les paramètres avant d\'envoyer une facture à la DGI.');
    }

    // Get currency rate
    const { data: currency } = await supabaseClient
      .from('currencies')
      .select('rate')
      .eq('company_id', profile.company_id)
      .eq('code', invoice.currency || 'CDF')
      .single();

    // Extract tax group from tax name (e.g., "Groupe A - TVA normale" -> "A")
    const extractTaxGroup = (taxName: string | null): string => {
      if (!taxName) return 'A';
      const match = taxName.match(/Groupe\s+([A-D])/i);
      return match ? match[1] : 'A';
    };

    // Map partner type to type description
    const getTypeDesc = (type: string): string => {
      const typeMap: Record<string, string> = {
        'PP': 'Personne physique',
        'PM': 'Personne morale',
        'PC': 'Personne civile',
        'PL': 'Personne légale',
        'AO': 'Administration et organisation',
      };
      return typeMap[type] || 'Personne physique';
    };

    // Prepare DGI payload
    const dgiPayload = {
      nif: company.nif,
      rn: invoice.number,
      mode: 'ht', // Use HT mode since invoice_lines.unit_price stores HT prices
      isf: company.nim,
      type: invoice.invoice_type_code || 'FV',
      items: invoice.lines.map((line: any) => ({
        code: line.product.sku,
        type: line.product.product_type_code || 'BIE',
        name: line.product.name,
        price: Number(line.unit_price),
        quantity: Number(line.qty),
        taxGroup: extractTaxGroup(line.tax?.name),
        taxSpecificValue: '0',
        taxSpecificAmount: 0,
        originalPrice: Number(line.unit_price),
        priceModification: '',
      })),
      client: {
        nif: invoice.partner.nif || '',
        name: invoice.partner.name,
        contact: invoice.partner.phone || '',
        address: invoice.partner.address || '',
        type: invoice.partner.type,
        typeDesc: getTypeDesc(invoice.partner.type),
      },
      operator: {
        id: '1',
        name: profile?.full_name || 'Opérateur',
      },
      payment: [
        {
          name: invoice.payment_method || 'ESPECES',
          amount: Number(invoice.total_ttc || 0),
          currencyCode: invoice.currency || 'CDF',
          currencyRate: Number(currency?.rate || 1),
        },
      ],
      reference: invoice.invoice_reference_type || '',
      referenceType: invoice.invoice_reference_type || '',
      referenceDesc: invoice.invoice_reference_type || '',
      cmta: '',
      curCode: invoice.currency || 'CDF',
      curDate: new Date(invoice.date).toISOString().replace('T', ' ').substring(0, 19),
      curRate: Number(currency?.rate || 1),
    };

    console.log('DGI payload:', JSON.stringify(dgiPayload, null, 2));

    // Get DGI API token from secrets
    const dgiApiToken = Deno.env.get('DGI_API_TOKEN');
    if (!dgiApiToken) {
      throw new Error('DGI_API_TOKEN not configured');
    }

    // Send to DGI API
    const dgiResponse = await fetch('https://developper.dgirdc.cd/edef/api/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dgiApiToken}`,
      },
      body: JSON.stringify(dgiPayload),
    });

    if (!dgiResponse.ok) {
      const errorText = await dgiResponse.text();
      console.error('DGI API error:', errorText);
      throw new Error(`DGI API error: ${dgiResponse.status} - ${errorText}`);
    }

    const dgiResult = await dgiResponse.json();
    console.log('DGI response:', dgiResult);

    // Update invoice with DGI UID
    if (dgiResult.uid) {
      const { error: updateError } = await supabaseClient
        .from('invoices')
        .update({ dgi_uid: dgiResult.uid })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Error updating invoice with DGI UID:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dgi_uid: dgiResult.uid,
        data: dgiResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error sending invoice to DGI:', error);
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
