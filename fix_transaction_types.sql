-- SQL script to fix existing transaction types in the database
-- Run this in your Supabase SQL editor

UPDATE transactions
SET transaction_type = CASE
  WHEN LOWER(transaction_type) = 'received' THEN 'Payment'
  WHEN LOWER(transaction_type) = 'reversal' THEN 'Reversal'
  WHEN LOWER(transaction_type) IN ('sent', 'withdrawal', 'unknown') THEN 'Payment'
  ELSE transaction_type
END
WHERE transaction_type NOT IN ('Payment', 'Reversal');
