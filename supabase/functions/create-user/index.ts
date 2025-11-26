import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé. Droits administrateur requis.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Get admin's company
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    console.log('Admin user ID:', user.id)
    console.log('Admin profile:', adminProfile)

    if (!adminProfile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'Entreprise non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Using company_id:', adminProfile.company_id)

    // Get company name
    const { data: companyData } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', adminProfile.company_id)
      .single()

    const companyName = companyData?.name || ''

    const { email, password, full_name, phone, role, account_type } = await req.json()

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Email, mot de passe, nom et rôle sont requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(u => u.email === email)
    
    if (userExists) {
      return new Response(
        JSON.stringify({ error: 'Un utilisateur avec cet email existe déjà' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Creating user with metadata:', {
      full_name,
      phone: phone || '',
      company_id: adminProfile.company_id,
      company_name: companyName,
      account_type: account_type || 'user'
    })

    // Create the user - the trigger will handle profile creation and role assignment
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || '',
        company_id: adminProfile.company_id,
        company_name: companyName,
        account_type: account_type || 'user'
      }
    })

    console.log('User created:', newUser?.user?.id)
    console.log('Create error:', createError)

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Wait for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500))

    // Override role if specified (trigger assigns 'user' by default for admin-created users)
    if (role && role !== 'user') {
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: role })
        .eq('user_id', newUser.user.id)

      if (roleUpdateError) {
        console.error('Role update error:', roleUpdateError)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Utilisateur créé avec succès',
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
