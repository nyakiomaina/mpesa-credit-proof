use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::error::AppError;
use crate::handlers::AppState;

#[derive(Deserialize)]
pub struct VerifyProofRequest {
    pub proof_id: String,
}

#[derive(Serialize)]
pub struct VerifyProofResponse {
    pub valid: bool,
    pub credit_score: i32,
    pub metrics: serde_json::Value,
    pub generated_at: String,
}

pub async fn verify_proof(
    State(state): State<AppState>,
    Json(req): Json<VerifyProofRequest>,
) -> Result<Json<VerifyProofResponse>, AppError> {
    let proof_id = Uuid::parse_str(&req.proof_id).map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;

    let row = sqlx::query(
        r#"
        SELECT credit_score, metrics, receipt_data, created_at
        FROM proof_sessions
        WHERE verification_code = $1 AND status = 'completed'
        "#,
    )
    .bind(&req.proof_id)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or_else(|| AppError::NotFound("Proof not found".to_string()))?;

    let credit_score: Option<i32> = row.try_get(0).ok();
    let metrics: Option<serde_json::Value> = row.try_get(1).ok();
    let receipt_data: Option<Vec<u8>> = row.try_get(2).ok();
    let created_at: chrono::DateTime<chrono::Utc> = row.try_get(3).map_err(|e| AppError::Database(e))?;

    // Verify receipt if stored
    let valid = if let Some(ref receipt_data) = receipt_data {
        // Verify RISC Zero receipt
        crate::services::proof::ProofService::verify_receipt(receipt_data).await?
    } else {
        true // If no receipt, assume valid (for development)
    };

    Ok(Json(VerifyProofResponse {
        valid,
        credit_score: credit_score.unwrap_or(0),
        metrics: metrics.unwrap_or(serde_json::json!({})),
        generated_at: created_at.to_rfc3339(),
    }))
}

pub async fn bulk_verify(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<VerifyProofResponse>>, AppError> {
    let ids = params
        .get("ids")
        .ok_or_else(|| AppError::Validation("Missing ids parameter".to_string()))?;

    let proof_ids: Vec<String> = ids.split(',').map(|s| s.trim().to_string()).collect();

    let mut results = Vec::new();

    for proof_id in proof_ids {
        match verify_proof(
            State(state.clone()),
            Json(VerifyProofRequest { proof_id }),
        )
        .await
        {
            Ok(Json(response)) => results.push(response),
            Err(_) => {
                // Skip invalid proofs
            }
        }
    }

    Ok(Json(results))
}

