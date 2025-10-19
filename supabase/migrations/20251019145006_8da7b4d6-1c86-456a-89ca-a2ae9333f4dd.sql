-- Create activation keys table
CREATE TABLE public.activation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  key_type TEXT NOT NULL DEFAULT 'standard', -- standard, premium, enterprise
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can view activation keys
CREATE POLICY "Only admins can view activation keys"
ON public.activation_keys FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Only admins can manage activation keys
CREATE POLICY "Only admins can manage activation keys"
ON public.activation_keys FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create activation history table
CREATE TABLE public.activation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID REFERENCES public.activation_keys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  previous_account_type TEXT,
  new_account_type TEXT
);

-- Enable RLS
ALTER TABLE public.activation_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own activation history
CREATE POLICY "Users can view own activation history"
ON public.activation_history FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admins can view all activation history
CREATE POLICY "Admins can view all activation history"
ON public.activation_history FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create function to activate account with key
CREATE OR REPLACE FUNCTION public.activate_account_with_key(
  activation_key TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_record activation_keys;
  user_profile profiles;
  new_account_type TEXT;
  result jsonb;
BEGIN
  -- Get the activation key
  SELECT * INTO key_record
  FROM activation_keys
  WHERE key = activation_key
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND current_uses < max_uses
  FOR UPDATE;

  -- Check if key exists and is valid
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Clé d''activation invalide ou expirée'
    );
  END IF;

  -- Get user profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE user_id = auth.uid();

  -- Check if already activated
  IF user_profile.account_type != 'demo' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce compte est déjà activé'
    );
  END IF;

  -- Determine new account type based on key type
  CASE key_record.key_type
    WHEN 'premium' THEN new_account_type := 'admin';
    WHEN 'enterprise' THEN new_account_type := 'admin';
    ELSE new_account_type := 'user';
  END CASE;

  -- Update profile
  UPDATE profiles
  SET 
    account_type = new_account_type,
    expires_at = NULL,
    updated_at = NOW()
  WHERE user_id = auth.uid();

  -- Update user role
  UPDATE user_roles
  SET role = new_account_type::app_role
  WHERE user_id = auth.uid();

  -- Increment key usage
  UPDATE activation_keys
  SET current_uses = current_uses + 1
  WHERE id = key_record.id;

  -- Record activation history
  INSERT INTO activation_history (
    key_id,
    user_id,
    company_id,
    previous_account_type,
    new_account_type
  ) VALUES (
    key_record.id,
    auth.uid(),
    user_profile.company_id,
    user_profile.account_type,
    new_account_type
  );

  RETURN jsonb_build_object(
    'success', true,
    'account_type', new_account_type,
    'message', 'Compte activé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.activate_account_with_key(TEXT) TO authenticated;