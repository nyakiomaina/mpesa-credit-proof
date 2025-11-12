use axum::{extract::{Path, State}, Json};
use serde::Serialize;
use sqlx::Row;

use crate::error::AppError;
use crate::handlers::AppState;

#[derive(Serialize)]
pub struct VerificationResponse {
    pub valid: bool,
    pub business_id: String,
    pub period: String,
    pub credit_score: i32,
    pub metrics: serde_json::Value,
}

pub async fn verify_code(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<VerificationResponse>, AppError> {
    let row = sqlx::query(
        r#"
        SELECT till_id, credit_score, metrics, created_at
        FROM proof_sessions
        WHERE verification_code = $1 AND status = 'completed'
        "#,
    )
    .bind(&code)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or_else(|| AppError::NotFound("Proof not found".to_string()))?;

    let till_id: uuid::Uuid = row.try_get(0).map_err(|e| AppError::Database(e))?;
    let credit_score: Option<i32> = row.try_get(1).ok();
    let metrics: Option<serde_json::Value> = row.try_get(2).ok();
    let created_at: chrono::DateTime<chrono::Utc> = row.try_get(3).map_err(|e| AppError::Database(e))?;

    // Get till info
    let till_row = sqlx::query("SELECT till_number FROM business_tills WHERE id = $1")
        .bind(till_id)
        .fetch_optional(&state.db)
        .await?;

    let till_number = till_row
        .map(|r| r.get::<String, _>(0))
        .unwrap_or_else(|| "unknown".to_string());

    // Hash till number for privacy
    let business_id = crate::utils::hash_phone_number(&till_number);

    // Calculate period (simplified - in production, use actual date range from transactions)
    let period = format!(
        "{} - {}",
        created_at.format("%b %Y"),
        created_at.format("%b %Y")
    );

    Ok(Json(VerificationResponse {
        valid: true,
        business_id,
        period,
        credit_score: credit_score.unwrap_or(0),
        metrics: metrics.unwrap_or(serde_json::json!({})),
    }))
}

