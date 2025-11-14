use redis::AsyncCommands;
use sqlx::{PgPool, Row};
use std::time::Duration;
use tracing::{error, info};
use uuid::Uuid;

use crate::config::Config;
use crate::models::Transaction;
use crate::services::proof::ProofService;

pub struct Worker {
    db: PgPool,
    redis: redis::Client,
    config: Config,
}

impl Worker {
    pub fn new(db: PgPool, redis: redis::Client, config: Config) -> Self {
        Self { db, redis, config }
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        info!("Starting proof generation worker...");

        loop {
            match self.process_next_job().await {
                Ok(processed) => {
                    if !processed {
                        // No jobs available, wait a bit
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
                Err(e) => {
                    error!("Error processing job: {}", e);
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            }
        }
    }

    async fn process_next_job(&self) -> anyhow::Result<bool> {
        let mut redis_conn = self.redis.get_async_connection().await?;

        // Blocking pop from queue (wait up to 5 seconds)
        let result: Option<(String, String)> = redis_conn.brpop("proof_queue", 5.0).await?;

        let session_id_str = result.map(|(_, val)| val);

        if let Some(session_id_str) = session_id_str {
            let session_id = uuid::Uuid::parse_str(&session_id_str)
                .map_err(|e| anyhow::anyhow!("Invalid UUID: {}", e))?;
            info!("Processing proof session: {}", session_id);

            // Update status to processing
            sqlx::query("UPDATE proof_sessions SET status = 'processing' WHERE id = $1")
                .bind(session_id)
                .execute(&self.db)
                .await?;

            // Load transactions for this session's till
            let row = sqlx::query("SELECT till_id FROM proof_sessions WHERE id = $1")
                .bind(session_id)
                .fetch_optional(&self.db)
                .await?;

            let session = if let Some(row) = row {
                Some((row.get::<Uuid, _>(0),))
            } else {
                None
            };

            if let Some((till_id,)) = session {
                let rows = sqlx::query(
                    r#"
                    SELECT id, till_id, timestamp, amount, transaction_type, reference, raw_data, created_at
                    FROM transactions
                    WHERE till_id = $1
                    ORDER BY timestamp ASC
                    "#,
                )
                .bind(till_id)
                .fetch_all(&self.db)
                .await?;

                let transactions: Vec<Transaction> = rows
                    .into_iter()
                    .map(|row| Transaction {
                        id: row.try_get(0).unwrap(),
                        till_id: row.try_get(1).unwrap(),
                        timestamp: row.try_get(2).unwrap(),
                        amount: row.try_get(3).unwrap(),
                        transaction_type: row.try_get(4).unwrap(),
                        reference: row.try_get(5).unwrap(),
                        raw_data: row.try_get(6).ok(),
                        created_at: row.try_get(7).unwrap(),
                    })
                    .collect();

                // Update progress
                sqlx::query("UPDATE proof_sessions SET progress = 50 WHERE id = $1")
                    .bind(session_id)
                    .execute(&self.db)
                    .await?;

                // Generate proof
                match ProofService::generate_proof(&self.db, session_id, transactions).await {
                    Ok(_) => {
                        info!("Proof generated successfully for session: {}", session_id);
                    }
                    Err(e) => {
                        error!("Failed to generate proof: {}", e);
                        sqlx::query(
                            "UPDATE proof_sessions SET status = 'failed', error_message = $1 WHERE id = $2",
                        )
                        .bind(e.to_string())
                        .bind(session_id)
                        .execute(&self.db)
                        .await?;
                    }
                }
            }

            Ok(true)
        } else {
            Ok(false)
        }
    }
}
