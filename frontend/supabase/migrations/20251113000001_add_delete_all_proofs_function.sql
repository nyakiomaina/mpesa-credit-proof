-- Migration: Add function to delete all proofs for a user
-- This function uses SECURITY DEFINER to bypass RLS for the user's own data

CREATE OR REPLACE FUNCTION delete_all_user_proofs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
  user_id UUID;
BEGIN
  -- Get the current authenticated user
  user_id := auth.uid();

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Delete all proofs for this user
  DELETE FROM proofs
  WHERE business_id = user_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_all_user_proofs() TO authenticated;

