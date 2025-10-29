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

    console.log('Creating user with metadata:', {
      full_name,
      phone: phone || '',
      company_id: adminProfile.company_id,
      company_name: companyName,
      account_type: account_type || 'user'
    })

    // Create the user - the trigger will handle profile creation
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

    // Wait a bit for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500))

    // Ensure profile exists with correct company_id (fallback if trigger didn't run)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('user_id', newUser.user.id)
      .maybeSingle()

    if (!existingProfile) {
      const { error: profileInsertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: newUser.user.id,
          full_name,
          phone: phone || '',
          company_id: adminProfile.company_id,
          company_name: companyName,
          account_type: account_type || 'user',
          expires_at: null
        })
      if (profileInsertError) {
        console.error('Profile insert error:', profileInsertError)
      }
    } else if (!existingProfile.company_id) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          company_id: adminProfile.company_id,
          company_name: companyName
        })
        .eq('id', existingProfile.id)
      if (profileUpdateError) {
        console.error('Profile update error:', profileUpdateError)
      }
    }

    // Assign role (user_roles not created by trigger when adding to existing company)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: role
      })

    if (roleError) {
      console.error('Role assignment error:', roleError)
      // Don't rollback, just report the error
      return new Response(
        JSON.stringify({ error: 'Utilisateur créé mais erreur lors de l\'assignation du rôle: ' + roleError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
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
