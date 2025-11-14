use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ProofService;

impl ProofService {
    pub async fn create_proof_session(
        db: &PgPool,
        user_id: Uuid,
        till_id: Uuid,
        _data_source: &str,
        _date_range: Option<&crate::handlers::proofs::DateRange>,
    ) -> anyhow::Result<Uuid> {
        let session_id = Uuid::new_v4();
        let verification_code = crate::utils::generate_verification_code();
        let expires_at = Utc::now() + chrono::Duration::days(365);

        sqlx::query(
            r#"
            INSERT INTO proof_sessions (id, user_id, till_id, status, verification_code, expires_at)
            VALUES ($1, $2, $3, 'pending', $4, $5)
            "#,
        )
        .bind(session_id)
        .bind(user_id)
        .bind(till_id)
        .bind(&verification_code)
        .bind(expires_at)
        .execute(db)
        .await?;

        Ok(session_id)
    }

    pub async fn verify_receipt(receipt_data: &[u8]) -> anyhow::Result<bool> {
        use methods::GUEST_CODE_FOR_ZK_PROOF_ID;
        use risc0_zkvm::Receipt;

        // Deserialize receipt
        let receipt: Receipt = bincode::deserialize(receipt_data)
            .map_err(|e| anyhow::anyhow!("Failed to deserialize receipt: {}", e))?;

        // Verify receipt against the expected program ID
        match receipt.verify(GUEST_CODE_FOR_ZK_PROOF_ID) {
            Ok(_) => Ok(true),
            Err(e) => {
                eprintln!("Receipt verification failed: {}", e);
                Ok(false)
            }
        }
    }

    pub async fn generate_proof(
        db: &PgPool,
        session_id: Uuid,
        transactions: Vec<crate::models::Transaction>,
    ) -> anyhow::Result<()> {
        // Update status to processing
        sqlx::query("UPDATE proof_sessions SET status = 'processing' WHERE id = $1")
            .bind(session_id)
            .execute(db)
            .await?;

        // Prepare input for zkVM
        let proof_input = crate::services::proof::ProofInput {
            transactions: transactions
                .into_iter()
                .map(|t| crate::services::proof::TransactionInput {
                    timestamp: t.timestamp.timestamp(),
                    amount: t.amount as u64,
                    transaction_type: t.transaction_type,
                    reference: t.reference,
                })
                .collect(),
        };

        // Execute zkVM proof generation
        let proof_output = Self::execute_zkvm_proof(proof_input).await?;

        // Store results
        sqlx::query(
            r#"
            UPDATE proof_sessions
            SET status = 'completed',
                credit_score = $1,
                metrics = $2,
                receipt_data = $3
            WHERE id = $4
            "#,
        )
        .bind(proof_output.credit_score as i32)
        .bind(serde_json::to_value(&proof_output.metrics)?)
        .bind(proof_output.receipt_data.as_ref())
        .bind(session_id)
        .execute(db)
        .await?;

        Ok(())
    }

    async fn execute_zkvm_proof(input: ProofInput) -> anyhow::Result<ProofOutput> {
        Self::execute_zkvm_proof_direct(input).await
    }

    // Public method for direct proof generation (used by generate_direct endpoint)
    pub async fn execute_zkvm_proof_direct(input: ProofInput) -> anyhow::Result<ProofOutput> {
        use methods::{GUEST_CODE_FOR_ZK_PROOF_ELF, GUEST_CODE_FOR_ZK_PROOF_ID};
        use risc0_zkvm::{default_prover, ExecutorEnv};

        tracing::info!(
            "🚀 Starting RISC Zero proof generation for {} transactions",
            input.transactions.len()
        );

        // RISC0_DEV_MODE environment variable is automatically respected by default_prover()
        // When set to 1, proof generation will be much faster (skips actual proving)
        let dev_mode = std::env::var("RISC0_DEV_MODE").unwrap_or_else(|_| "0".to_string());
        if dev_mode == "1" {
            tracing::warn!("⚠️  RISC0_DEV_MODE=1 - Proof generation will be faster but proofs will not be valid for production");
        }

        // RISC Zero's prove() is blocking, so we use block_in_place to run it
        // This moves the blocking work to a blocking thread pool
        let (receipt_data, output) =
            tokio::task::block_in_place(|| -> anyhow::Result<(Vec<u8>, ProofOutput)> {
                tracing::info!("📦 Building RISC Zero execution environment...");
                let env = ExecutorEnv::builder()
                    .write(&input)
                    .map_err(|e| {
                        tracing::error!("❌ Failed to build execution environment: {}", e);
                        anyhow::anyhow!("Env build error: {}", e)
                    })?
                    .build()
                    .map_err(|e| {
                        tracing::error!("❌ Failed to build execution environment: {}", e);
                        anyhow::anyhow!("Env build error: {}", e)
                    })?;

                tracing::info!("🔐 Starting RISC Zero prover (this may take a while)...");
                let prover = default_prover();
                let prove_info = prover
                    .prove(env, GUEST_CODE_FOR_ZK_PROOF_ELF)
                    .map_err(|e| {
                        tracing::error!("❌ RISC Zero proof generation failed: {}", e);
                        e
                    })?;
                let receipt = prove_info.receipt;

                tracing::info!("✅ RISC Zero proof generated successfully!");
                tracing::info!("🔍 Verifying receipt...");

                // Verify receipt
                receipt.verify(GUEST_CODE_FOR_ZK_PROOF_ID).map_err(|e| {
                    tracing::error!("❌ Receipt verification failed: {}", e);
                    e
                })?;

                tracing::info!("✅ Receipt verified successfully!");

                // Decode output
                tracing::info!("📊 Decoding proof output...");
                let output: ProofOutput = receipt.journal.decode().map_err(|e| {
                    tracing::error!("❌ Failed to decode output: {}", e);
                    e
                })?;

                tracing::info!(
                    "✅ Proof output decoded: credit_score={}, monthly_volume_range={:?}",
                    output.credit_score,
                    output.metrics.monthly_volume_range
                );

                // Serialize receipt for storage
                let receipt_data = bincode::serialize(&receipt).map_err(|e| {
                    tracing::error!("❌ Failed to serialize receipt: {}", e);
                    e
                })?;

                tracing::info!("💾 Receipt serialized ({} bytes)", receipt_data.len());
                tracing::info!("🎉 RISC Zero proof generation completed successfully!");

                Ok((receipt_data, output))
            })?;

        Ok(ProofOutput {
            receipt_data: Some(receipt_data),
            ..output
        })
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProofInput {
    pub transactions: Vec<TransactionInput>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct TransactionInput {
    pub timestamp: i64,
    pub amount: u64,
    pub transaction_type: String,
    pub reference: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProofOutput {
    pub credit_score: u32,
    pub metrics: crate::models::BusinessMetrics,
    pub receipt_data: Option<Vec<u8>>,
}
