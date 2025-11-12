/*
  # M-Pesa Credit Proof Platform Schema

  ## Overview
  This migration creates the complete database schema for a zero-knowledge proof-based
  M-Pesa credit verification platform. The system allows businesses to generate verifiable
  credit proofs from their M-Pesa transaction data without exposing raw transaction details
  to lenders.

  ## New Tables

  ### 1. `businesses`
  Stores business user accounts and profile information
  - `id` (uuid, primary key) - Links to auth.users
  - `business_name` (text) - Legal or trading name
  - `contact_email` (text) - Business contact email
  - `kra_pin` (text, optional) - Kenya Revenue Authority PIN
  - `registration_number` (text, optional) - Business registration number
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update

  ### 2. `transaction_uploads`
  Tracks M-Pesa data uploads from businesses
  - `id` (uuid, primary key) - Unique upload identifier
  - `business_id` (uuid, foreign key) - References businesses.id
  - `file_name` (text) - Original uploaded file name
  - `transaction_count` (integer) - Number of transactions parsed
  - `date_range_start` (date) - Earliest transaction date
  - `date_range_end` (date) - Latest transaction date
  - `total_volume` (numeric) - Total transaction volume in KES
  - `status` (text) - Processing status: pending, parsed, failed
  - `uploaded_at` (timestamptz) - Upload timestamp
  - `processed_at` (timestamptz, optional) - Processing completion time

  ### 3. `transactions`
  Stores sanitized M-Pesa transaction records
  - `id` (uuid, primary key) - Unique transaction identifier
  - `upload_id` (uuid, foreign key) - References transaction_uploads.id
  - `business_id` (uuid, foreign key) - References businesses.id
  - `transaction_date` (timestamptz) - Transaction timestamp
  - `transaction_type` (text) - Type: received, sent, withdrawal, etc.
  - `amount` (numeric) - Transaction amount in KES
  - `balance_after` (numeric, optional) - Balance after transaction
  - `customer_hash` (text, optional) - Hashed customer identifier (for privacy)
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. `proofs`
  Stores generated zero-knowledge proofs and derived metrics
  - `id` (uuid, primary key) - Unique proof identifier
  - `business_id` (uuid, foreign key) - References businesses.id
  - `upload_id` (uuid, foreign key) - References transaction_uploads.id
  - `verification_code` (text, unique) - Short code for lender verification (e.g., MPC-7F29)
  - `credit_score` (integer) - Computed score 0-100
  - `monthly_volume` (numeric) - 30-day transaction volume
  - `average_ticket_size` (numeric) - Average transaction amount
  - `customer_diversity_score` (integer) - Measure of unique customers
  - `growth_trend` (text) - Trend: growing, stable, declining
  - `consistency_score` (integer) - Payment regularity score 0-100
  - `activity_frequency` (text) - Activity level: high, medium, low
  - `proof_data` (jsonb) - ZK proof metadata and circuit data
  - `circuit_version` (text) - RISC Zero circuit version used
  - `status` (text) - Status: generating, valid, expired, failed
  - `generated_at` (timestamptz) - Proof generation timestamp
  - `expires_at` (timestamptz) - Proof expiration timestamp
  - `verified_at` (timestamptz, optional) - First verification timestamp

  ### 5. `verification_logs`
  Tracks lender verification attempts
  - `id` (uuid, primary key) - Unique log entry identifier
  - `proof_id` (uuid, foreign key) - References proofs.id
  - `verification_code` (text) - Code used for verification
  - `verified_at` (timestamptz) - Verification attempt timestamp
  - `success` (boolean) - Whether verification succeeded
  - `ip_address` (text, optional) - Verifier IP address (for audit)
  - `user_agent` (text, optional) - Verifier browser/client info

  ## Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with policies that ensure:
  - Businesses can only access their own data
  - Verification page is public but read-only
  - No unauthorized data modification
  - Authentication required for business operations

  ### Policies Applied
  - Businesses: Users can read/update only their own business profile
  - Uploads: Users can manage only their own uploads
  - Transactions: Users can only access transactions from their uploads
  - Proofs: Users can manage their own proofs; public read via verification code
  - Verification logs: Append-only for verification tracking

  ## Indexes
  - businesses.id (primary key index)
  - transaction_uploads.business_id (foreign key index)
  - transactions.upload_id, business_id (foreign key indexes)
  - transactions.transaction_date (for date range queries)
  - proofs.business_id, verification_code (lookup optimization)
  - verification_logs.proof_id (audit trail queries)

  ## Notes
  - All timestamps use `timestamptz` for proper timezone handling
  - Numeric types used for monetary values to avoid floating-point errors
  - Customer identifiers are hashed to preserve privacy
  - Proof expiration is set at generation time (e.g., 90 days)
  - Verification codes are short, memorable codes for easy sharing
*/

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact_email text NOT NULL,
  kra_pin text,
  registration_number text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create transaction_uploads table
CREATE TABLE IF NOT EXISTS transaction_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  transaction_count integer DEFAULT 0 NOT NULL,
  date_range_start date,
  date_range_end date,
  total_volume numeric(15, 2) DEFAULT 0 NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'parsed', 'failed'))
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES transaction_uploads(id) ON DELETE CASCADE NOT NULL,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  transaction_date timestamptz NOT NULL,
  transaction_type text NOT NULL,
  amount numeric(15, 2) NOT NULL,
  balance_after numeric(15, 2),
  customer_hash text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create proofs table
CREATE TABLE IF NOT EXISTS proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  upload_id uuid REFERENCES transaction_uploads(id) ON DELETE SET NULL,
  verification_code text UNIQUE NOT NULL,
  credit_score integer NOT NULL CHECK (credit_score >= 0 AND credit_score <= 100),
  monthly_volume numeric(15, 2) NOT NULL,
  average_ticket_size numeric(15, 2) NOT NULL,
  customer_diversity_score integer NOT NULL CHECK (customer_diversity_score >= 0 AND customer_diversity_score <= 100),
  growth_trend text NOT NULL CHECK (growth_trend IN ('growing', 'stable', 'declining')),
  consistency_score integer NOT NULL CHECK (consistency_score >= 0 AND consistency_score <= 100),
  activity_frequency text NOT NULL CHECK (activity_frequency IN ('high', 'medium', 'low')),
  proof_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  circuit_version text NOT NULL DEFAULT 'v1.0',
  status text DEFAULT 'generating' NOT NULL,
  generated_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  CONSTRAINT valid_proof_status CHECK (status IN ('generating', 'valid', 'expired', 'failed'))
);

-- Create verification_logs table
CREATE TABLE IF NOT EXISTS verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id uuid REFERENCES proofs(id) ON DELETE CASCADE NOT NULL,
  verification_code text NOT NULL,
  verified_at timestamptz DEFAULT now() NOT NULL,
  success boolean DEFAULT false NOT NULL,
  ip_address text,
  user_agent text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_uploads_business_id ON transaction_uploads(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_upload_id ON transactions(upload_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business_id ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_proofs_business_id ON proofs(business_id);
CREATE INDEX IF NOT EXISTS idx_proofs_verification_code ON proofs(verification_code);
CREATE INDEX IF NOT EXISTS idx_verification_logs_proof_id ON verification_logs(proof_id);

-- Enable Row Level Security
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for businesses
CREATE POLICY "Users can view own business profile"
  ON businesses FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own business profile"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own business profile"
  ON businesses FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for transaction_uploads
CREATE POLICY "Users can view own uploads"
  ON transaction_uploads FOR SELECT
  TO authenticated
  USING (business_id = auth.uid());

CREATE POLICY "Users can insert own uploads"
  ON transaction_uploads FOR INSERT
  TO authenticated
  WITH CHECK (business_id = auth.uid());

CREATE POLICY "Users can update own uploads"
  ON transaction_uploads FOR UPDATE
  TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

CREATE POLICY "Users can delete own uploads"
  ON transaction_uploads FOR DELETE
  TO authenticated
  USING (business_id = auth.uid());

-- RLS Policies for transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (business_id = auth.uid());

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (business_id = auth.uid());

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (business_id = auth.uid());

-- RLS Policies for proofs
CREATE POLICY "Users can view own proofs"
  ON proofs FOR SELECT
  TO authenticated
  USING (business_id = auth.uid());

CREATE POLICY "Public can view proofs by verification code"
  ON proofs FOR SELECT
  TO anon
  USING (status = 'valid' AND expires_at > now());

CREATE POLICY "Users can insert own proofs"
  ON proofs FOR INSERT
  TO authenticated
  WITH CHECK (business_id = auth.uid());

CREATE POLICY "Users can update own proofs"
  ON proofs FOR UPDATE
  TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

-- RLS Policies for verification_logs
CREATE POLICY "Anyone can insert verification logs"
  ON verification_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view logs for own proofs"
  ON verification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = verification_logs.proof_id
      AND proofs.business_id = auth.uid()
    )
  );