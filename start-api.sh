#!/bin/bash
cd api
export $(cat ../.env | xargs 2>/dev/null || true)

# Use Supabase database URL if available, otherwise fallback to local
# Get Supabase connection details from frontend/.env.local (same as frontend uses)
ENV_FILE="../frontend/.env.local"
if [ -f "$ENV_FILE" ]; then
    # First, check if there's already a SUPABASE_DB_URL or DATABASE_URL in .env.local
    SUPABASE_DB_URL_FROM_FILE=$(grep -E "^SUPABASE_DB_URL=|^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)
    if [ ! -z "$SUPABASE_DB_URL_FROM_FILE" ]; then
        export SUPABASE_DB_URL="$SUPABASE_DB_URL_FROM_FILE"
    else
        # Otherwise, construct it from VITE_SUPABASE_URL
        SUPABASE_URL=$(grep "VITE_SUPABASE_URL" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
        if [ ! -z "$SUPABASE_URL" ]; then
            # Extract project ref from Supabase URL (e.g., https://xxxxx.supabase.co -> xxxxx)
            PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's|https?://([^.]+)\..*|\1|')
            # Check for database password in root .env or .env.local
            SUPABASE_DB_PASSWORD=$(grep "SUPABASE_DB_PASSWORD" ../.env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
            if [ -z "$SUPABASE_DB_PASSWORD" ]; then
                SUPABASE_DB_PASSWORD=$(grep "SUPABASE_DB_PASSWORD" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
            fi
            # Construct direct PostgreSQL connection string if password is available
            if [ ! -z "$SUPABASE_DB_PASSWORD" ]; then
                export SUPABASE_DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
            fi
        fi
    fi
fi

export DATABASE_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/mpesa_credit}}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export BIND_ADDRESS="0.0.0.0:8080"
cargo run --bin api
