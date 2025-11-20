import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('Request method:', req.method)
    const contentType = req.headers.get('content-type') || ''
    console.log('Content-Type:', contentType)
    
    let liaisonId: string
    
    // Parse request body based on content type
    try {
      if (contentType.includes('application/json')) {
        const body = await req.json()
        liaisonId = body.liaison_id
      } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData()
        liaisonId = formData.get('liaison_id')?.toString() || ''
      } else {
        throw new Error('Type de contenu non supporté')
      }
      
      if (!liaisonId) {
        throw new Error('liaison_id est requis')
      }
      
      console.log('Checking liaison status for ID:', liaisonId)
    } catch (error) {
      console.error('Parsing error:', error)
      return new Response(
        JSON.stringify({ 
          statut: 1,
          message: 'Erreur de parsing des données',
          details: error instanceof Error ? error.message : 'Erreur inconnue'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Find liaison by ID
    const { data: liaison, error: liaisonError } = await supabase
      .from('application_liaisons')
      .select('id, status, approved_at')
      .eq('id', liaisonId)
      .single()

    if (liaisonError || !liaison) {
      console.error('Liaison not found:', liaisonError)
      return new Response(
        JSON.stringify({ 
          statut: 1,
          message: 'Demande de liaison introuvable'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check status
    if (liaison.status === 'approved') {
      console.log('Liaison approved:', liaison)
      return new Response(
        JSON.stringify({ 
          statut: 0,
          message: 'Demande acceptée'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.log('Liaison pending:', liaison)
      return new Response(
        JSON.stringify({ 
          statut: 1,
          message: 'Demande en attente'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Error checking liaison status:', error)
    return new Response(
      JSON.stringify({ 
        statut: 1,
        message: 'Erreur interne du serveur'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
