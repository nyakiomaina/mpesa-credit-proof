# Setting Up Backend to Use Supabase

The backend can now use Supabase's PostgreSQL database instead of a separate database. This eliminates data duplication and keeps everything in one place.

## Getting Your Supabase Database Connection String

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **Settings** → **Database**
3. Scroll down to **Connection string**
4. Select **URI** or **Connection pooling** mode
5. Copy the connection string (it looks like):
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

## Configuration Options

### Option 1: Use Environment Variable (Recommended)

Add to your `.env` file in the project root:

```bash
# Supabase Database Connection (direct PostgreSQL connection)
SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[your-password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Or use the regular DATABASE_URL
DATABASE_URL=postgresql://postgres.[project-ref]:[your-password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Option 2: Update start-api.sh

The `start-api.sh` script will automatically try to construct the connection string from your frontend `.env` file if you set:

```bash
SUPABASE_DB_PASSWORD=your-supabase-database-password
```

## Important Notes

1. **Service Role vs Connection Pooling**:
   - Use the **Connection pooling** mode for better performance
   - The connection string uses port `6543` (pooler) instead of `5432` (direct)

2. **Password**: You'll need your Supabase database password. If you forgot it:
   - Go to **Settings** → **Database** → **Database password**
   - You can reset it if needed

3. **Migrations**: The backend will still run its migrations, but make sure they don't conflict with your Supabase schema. Consider:
   - Removing backend-specific tables that duplicate Supabase tables
   - Or using Supabase migrations instead of backend migrations

4. **Row Level Security (RLS)**: The backend connects directly to PostgreSQL, so it bypasses RLS. This is fine for backend operations, but be aware that:
   - The backend has full database access
   - You should use the service role password, not the anon key

## Current Schema Differences

The backend currently has these tables that might overlap with Supabase:
- `proof_sessions` (backend) vs `proofs` (Supabase)
- `users` (backend) vs `businesses` (Supabase)
- `business_tills` (backend) - might not exist in Supabase

Consider consolidating these schemas for a cleaner architecture.

