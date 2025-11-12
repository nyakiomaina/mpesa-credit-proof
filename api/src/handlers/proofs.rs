use axum::{extract::{Path, State}, Json};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::error::AppError;
use crate::handlers::{AppState, Claims};
use crate::services::proof::ProofService;

#[derive(Deserialize)]
pub struct GenerateProofRequest {
    pub till_id: String,
    pub data_source: String, // "upload" or "api"
    pub date_range: Option<DateRange>,
}

#[derive(Deserialize)]
pub struct DateRange {
    pub from: String,
    pub to: String,
}

#[derive(Serialize)]
pub struct GenerateProofResponse {
    pub session_id: String,
    pub status: String,
    pub estimated_time: u32,
}

#[derive(Serialize)]
pub struct ProofStatusResponse {
    pub status: String,
    pub progress: Option<i32>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct ProofResultResponse {
    pub proof_id: String,
    pub credit_score: i32,
    pub metrics: serde_json::Value,
    pub verification_url: String,
    pub expires_at: String,
}

pub async fn generate_proof(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<GenerateProofRequest>,
) -> Result<Json<GenerateProofResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.user_id).map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;
    let till_id = Uuid::parse_str(&req.till_id).map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;

    // Verify till belongs to user
    let row = sqlx::query("SELECT user_id FROM business_tills WHERE id = $1")
        .bind(till_id)
        .fetch_optional(&state.db)
        .await?;

    let till_user_id: Uuid = row
        .ok_or_else(|| AppError::NotFound("Till not found".to_string()))?
        .try_get::<Uuid, _>(0)
        .map_err(|e| AppError::Database(e))?;

    if till_user_id != user_id {
        return Err(AppError::Auth("Unauthorized".to_string()));
    }

    let session_id = ProofService::create_proof_session(
        &state.db,
        user_id,
        till_id,
        &req.data_source,
        req.date_range.as_ref(),
    )
    .await?;

    // Queue proof generation job
    let mut redis_conn = state.redis.get_async_connection().await?;
    redis_conn.lpush("proof_queue", session_id.to_string()).await.map_err(|e| AppError::Redis(e))?;

    Ok(Json(GenerateProofResponse {
        session_id: session_id.to_string(),
        status: "processing".to_string(),
        estimated_time: 30,
    }))
}

pub async fn get_proof_status(
    State(state): State<AppState>,
    claims: Claims,
    Path(session_id): Path<String>,
) -> Result<Json<ProofStatusResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.user_id).map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;
    let session_id = Uuid::parse_str(&session_id).map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;

    let row = sqlx::query(
        r#"
        SELECT status, progress, error_message
        FROM proof_sessions
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    let session = if let Some(row) = row {
        Some((
            row.try_get::<crate::models::ProofStatus, _>(0).ok(),
            row.try_get::<Option<i32>, _>(1).ok().flatten(),
            row.try_get::<Option<String>, _>(2).ok().flatten(),
        ))
    } else {
        None
    };

    let (status_opt, progress, error_message) = session.ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;
    let status = status_opt.ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

    Ok(Json(ProofStatusResponse {
        status: format!("{:?}", status),
        progress,
        error: error_message,
    }))
}

pub async fn get_proof_result(
    State(state): State<AppState>,
    claims: Claims,
    Path(session_id): Path<String>,
) -> Result<Json<ProofResultResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.user_id).map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;
    let session_id = Uuid::parse_str(&session_id).map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;

    let row = sqlx::query(
        r#"
        SELECT id, credit_score, metrics, verification_code, expires_at
        FROM proof_sessions
        WHERE id = $1 AND user_id = $2 AND status = 'completed'
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or_else(|| AppError::NotFound("Proof not found or not completed".to_string()))?;

    let id: Uuid = row.try_get(0).map_err(|e| AppError::Database(e))?;
    let credit_score: Option<i32> = row.try_get(1).ok();
    let metrics: Option<serde_json::Value> = row.try_get(2).ok();
    let verification_code: String = row.try_get(3).map_err(|e| AppError::Database(e))?;
    let expires_at: chrono::DateTime<chrono::Utc> = row.try_get(4).map_err(|e| AppError::Database(e))?;

    let verification_url = format!("https://app.domain.com/verify/{}", verification_code);

    Ok(Json(ProofResultResponse {
        proof_id: id.to_string(),
        credit_score: credit_score.unwrap_or(0),
        metrics: metrics.unwrap_or(serde_json::json!({})),
        verification_url,
        expires_at: expires_at.to_rfc3339(),
    }))
}

pub async fn list_proofs(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    let user_id = Uuid::parse_str(&claims.user_id).map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;

    let rows = sqlx::query(
        r#"
        SELECT id, till_id, status, credit_score, created_at
        FROM proof_sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let response: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            let id: Uuid = row.try_get(0).unwrap();
            let till_id: Uuid = row.try_get(1).unwrap();
            let status: crate::models::ProofStatus = row.try_get(2).unwrap();
            let credit_score: Option<i32> = row.try_get(3).ok();
            let created_at: chrono::DateTime<chrono::Utc> = row.try_get(4).unwrap();

            serde_json::json!({
                "id": id.to_string(),
                "till_id": till_id.to_string(),
                "status": format!("{:?}", status),
                "credit_score": credit_score,
                "created_at": created_at.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(response))
}

