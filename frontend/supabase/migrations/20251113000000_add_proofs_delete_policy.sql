-- Migration: Add DELETE policy for proofs table
-- This allows users to delete their own proofs
-- Note: This uses DROP + CREATE to ensure the policy is correct even if it exists

DROP POLICY IF EXISTS "Users can delete own proofs" ON proofs;

CREATE POLICY "Users can delete own proofs"
  ON proofs FOR DELETE
  TO authenticated
  USING (business_id = auth.uid());

