import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LiaisonRequest {
  code_societe: string
  code_etablissement: string
  nom_etablissement: string
  type_etablissement: string
  administrateur_etablissement: string
  phone_etablissement: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const requestData: LiaisonRequest = await req.json()
    
    console.log('Received liaison request:', requestData)

    // Validate required fields
    const requiredFields = [
      'code_societe',
      'code_etablissement',
      'nom_etablissement',
      'type_etablissement',
      'administrateur_etablissement',
      'phone_etablissement'
    ]
    
    for (const field of requiredFields) {
      if (!requestData[field as keyof LiaisonRequest]) {
        return new Response(
          JSON.stringify({ error: `Le champ ${field} est requis` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Find company by company_code
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('company_code', requestData.code_societe)
      .single()

    if (companyError || !company) {
      console.error('Company not found:', companyError)
      return new Response(
        JSON.stringify({ error: 'Code société invalide' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Determine application type based on type_etablissement
    let applicationType: string
    if (requestData.type_etablissement.toLowerCase().includes('resto') || 
        requestData.type_etablissement.toLowerCase().includes('hotel')) {
      applicationType = 'loyambo_resto_hotel'
    } else if (requestData.type_etablissement.toLowerCase().includes('payroll') || 
               requestData.type_etablissement.toLowerCase().includes('paie')) {
      applicationType = 'millenium_payroll'
    } else {
      applicationType = 'other'
    }

    // Create liaison request
    const { data: liaison, error: liaisonError } = await supabase
      .from('application_liaisons')
      .insert({
        company_id: company.id,
        application_type: applicationType,
        application_name: requestData.nom_etablissement,
        status: 'pending',
        requested_by: company.id, // Using company_id as placeholder since it's external
        code_etablissement: requestData.code_etablissement,
        nom_etablissement: requestData.nom_etablissement,
        type_etablissement: requestData.type_etablissement,
        administrateur_etablissement: requestData.administrateur_etablissement,
        phone_etablissement: requestData.phone_etablissement,
        request_message: `Demande de liaison externe de ${requestData.nom_etablissement} (${requestData.code_etablissement})`
      })
      .select()
      .single()

    if (liaisonError) {
      console.error('Error creating liaison:', liaisonError)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de la demande' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Liaison request created successfully:', liaison)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Demande de liaison créée avec succès',
        liaison_id: liaison.id
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing liaison request:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
