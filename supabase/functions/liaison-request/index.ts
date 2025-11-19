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

// Input validation
function validateLiaisonRequest(data: any): { valid: boolean; error?: string } {
  const requiredFields = [
    'code_societe',
    'code_etablissement',
    'nom_etablissement',
    'type_etablissement',
    'administrateur_etablissement',
    'phone_etablissement'
  ]
  
  for (const field of requiredFields) {
    if (!data[field] || typeof data[field] !== 'string' || data[field].trim() === '') {
      return { valid: false, error: `Le champ ${field} est requis et doit être une chaîne non vide` }
    }
    
    // Length validation
    if (data[field].length > 500) {
      return { valid: false, error: `Le champ ${field} est trop long (maximum 500 caractères)` }
    }
  }
  
  // Phone validation (basic format check)
  const phoneRegex = /^[\d\s\+\-\(\)]+$/
  if (!phoneRegex.test(data.phone_etablissement)) {
    return { valid: false, error: 'Le numéro de téléphone contient des caractères invalides' }
  }
  
  return { valid: true }
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
    let requestData: LiaisonRequest
    
    try {
      requestData = await req.json()
    } catch (error) {
      console.error('Invalid JSON:', error)
      return new Response(
        JSON.stringify({ error: 'Format JSON invalide' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('Received liaison request:', {
      code_societe: requestData.code_societe,
      code_etablissement: requestData.code_etablissement,
      nom_etablissement: requestData.nom_etablissement
    })

    // Validate input data
    const validation = validateLiaisonRequest(requestData)
    if (!validation.valid) {
      console.error('Validation error:', validation.error)
      return new Response(
        JSON.stringify({ error: validation.error }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Sanitize input data
    const sanitizedData: LiaisonRequest = {
      code_societe: requestData.code_societe.trim(),
      code_etablissement: requestData.code_etablissement.trim(),
      nom_etablissement: requestData.nom_etablissement.trim(),
      type_etablissement: requestData.type_etablissement.trim(),
      administrateur_etablissement: requestData.administrateur_etablissement.trim(),
      phone_etablissement: requestData.phone_etablissement.trim()
    }

    // Find company by company_code
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('company_code', sanitizedData.code_societe)
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
    if (sanitizedData.type_etablissement.toLowerCase().includes('resto') || 
        sanitizedData.type_etablissement.toLowerCase().includes('hotel')) {
      applicationType = 'loyambo_resto_hotel'
    } else if (sanitizedData.type_etablissement.toLowerCase().includes('payroll') || 
               sanitizedData.type_etablissement.toLowerCase().includes('paie')) {
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
        application_name: sanitizedData.nom_etablissement,
        status: 'pending',
        requested_by: company.id, // Using company_id as placeholder since it's external
        code_etablissement: sanitizedData.code_etablissement,
        nom_etablissement: sanitizedData.nom_etablissement,
        type_etablissement: sanitizedData.type_etablissement,
        administrateur_etablissement: sanitizedData.administrateur_etablissement,
        phone_etablissement: sanitizedData.phone_etablissement,
        request_message: `Demande de liaison externe de ${sanitizedData.nom_etablissement} (${sanitizedData.code_etablissement})`
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
