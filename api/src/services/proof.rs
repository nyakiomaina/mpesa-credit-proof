use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ProofService;

impl ProofService {
    pub async fn create_proof_session(
        db: &PgPool,
        user_id: Uuid,
        till_id: Uuid,
        data_source: &str,
        date_range: Option<&crate::handlers::proofs::DateRange>,
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
        // In production, deserialize and verify RISC Zero receipt
        // For now, return true if receipt exists
        Ok(!receipt_data.is_empty())
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

    async fn execute_zkvm_proof(
        input: ProofInput,
    ) -> anyhow::Result<ProofOutput> {
        use methods::{GUEST_CODE_FOR_ZK_PROOF_ELF, GUEST_CODE_FOR_ZK_PROOF_ID};
        use risc0_zkvm::{default_prover, ExecutorEnv, Receipt};

        let env = ExecutorEnv::builder()
            .write(&input)
            .unwrap()
            .build()
            .unwrap();

        let prover = default_prover();
        let prove_info = prover.prove(env, GUEST_CODE_FOR_ZK_PROOF_ELF)?;
        let receipt = prove_info.receipt;

        // Verify receipt
        receipt.verify(GUEST_CODE_FOR_ZK_PROOF_ID)?;

        // Decode output
        let output: ProofOutput = receipt.journal.decode()?;

        // Serialize receipt for storage
        let receipt_data = bincode::serialize(&receipt)?;

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

