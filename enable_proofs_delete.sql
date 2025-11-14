-- ============================================
-- ENABLE PROOF DELETION FOR M-PESA CREDIT PROOF
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Remove existing policy if it exists (to fix any misconfigurations)
DROP POLICY IF EXISTS "Users can delete own proofs" ON proofs;

-- Step 2: Create the DELETE policy
CREATE POLICY "Users can delete own proofs"
  ON proofs FOR DELETE
  TO authenticated
  USING (business_id = auth.uid());

-- Step 3: Verify the policy was created successfully
SELECT
  policyname,
  cmd,
  qual,
  roles
FROM pg_policies
WHERE tablename = 'proofs'
  AND policyname = 'Users can delete own proofs';

-- Expected result: One row showing:
-- policyname: "Users can delete own proofs"
-- cmd: "DELETE"
-- qual: "(business_id = auth.uid())"
-- roles: "{authenticated}"

