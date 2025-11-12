-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE till_type AS ENUM ('BuyGoods', 'PayBill');
CREATE TYPE proof_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone_number);

-- Business tills table
CREATE TABLE business_tills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    till_number VARCHAR(20) NOT NULL,
    till_type till_type NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    api_connected BOOLEAN NOT NULL DEFAULT false,
    verification_method VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, till_number)
);

CREATE INDEX idx_tills_user ON business_tills(user_id);
CREATE INDEX idx_tills_number ON business_tills(till_number);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    till_id UUID NOT NULL REFERENCES business_tills(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    amount BIGINT NOT NULL, -- In cents
    transaction_type VARCHAR(50) NOT NULL,
    reference VARCHAR(255) NOT NULL, -- Hashed
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(till_id, reference)
);

CREATE INDEX idx_transactions_till ON transactions(till_id);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX idx_transactions_reference ON transactions(reference);

-- Proof sessions table
CREATE TABLE proof_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    till_id UUID NOT NULL REFERENCES business_tills(id) ON DELETE CASCADE,
    status proof_status NOT NULL DEFAULT 'pending',
    progress INTEGER,
    credit_score INTEGER,
    metrics JSONB,
    receipt_data BYTEA,
    verification_code VARCHAR(50) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proof_sessions_user ON proof_sessions(user_id);
CREATE INDEX idx_proof_sessions_till ON proof_sessions(till_id);
CREATE INDEX idx_proof_sessions_code ON proof_sessions(verification_code);
CREATE INDEX idx_proof_sessions_status ON proof_sessions(status);

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tills_updated_at BEFORE UPDATE ON business_tills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proof_sessions_updated_at BEFORE UPDATE ON proof_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();





