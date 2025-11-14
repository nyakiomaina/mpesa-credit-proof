use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::error::AppError;
use crate::handlers::{AppState, Claims};
use crate::models::TillType;

#[derive(Deserialize)]
pub struct RegisterTillRequest {
    pub till_number: String,
    pub till_type: TillType,
}

#[derive(Serialize)]
pub struct RegisterTillResponse {
    pub till_id: String,
    pub verification_required: bool,
    pub verification_method: String,
}

#[derive(Deserialize)]
pub struct VerifyTillRequest {
    pub till_id: String,
    pub verification_code: Option<String>,
}

#[derive(Serialize)]
pub struct TillResponse {
    pub id: String,
    pub till_number: String,
    pub till_type: String,
    pub is_verified: bool,
    pub api_connected: bool,
}

pub async fn register_till(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<RegisterTillRequest>,
) -> Result<Json<RegisterTillResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.user_id)
        .map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;

    // Validate till number format (5-7 digits)
    if !req.till_number.chars().all(|c| c.is_ascii_digit())
        || req.till_number.len() < 5
        || req.till_number.len() > 7
    {
        return Err(AppError::Validation(
            "Invalid till number format".to_string(),
        ));
    }

    let till_id = Uuid::new_v4();
    let verification_method = "test_transaction".to_string();

    sqlx::query(
        r#"
        INSERT INTO business_tills (id, user_id, till_number, till_type, is_verified, verification_method)
        VALUES ($1, $2, $3, $4::till_type, false, $5)
        "#,
    )
    .bind(till_id)
    .bind(user_id)
    .bind(&req.till_number)
    .bind(&req.till_type as &TillType)
    .bind(&verification_method)
    .execute(&state.db)
    .await?;

    Ok(Json(RegisterTillResponse {
        till_id: till_id.to_string(),
        verification_required: true,
        verification_method,
    }))
}

pub async fn verify_till(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<VerifyTillRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.user_id)
        .map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;
    let till_id = Uuid::parse_str(&req.till_id)
        .map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;

    // Check if till belongs to user
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

    // For now, mark as verified (in production, verify via test transaction or API)
    sqlx::query("UPDATE business_tills SET is_verified = true WHERE id = $1")
        .bind(till_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({
        "verified": true
    })))
}

pub async fn list_tills(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<TillResponse>>, AppError> {
    let user_id = Uuid::parse_str(&claims.user_id)
        .map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;

    let rows = sqlx::query(
        r#"
        SELECT id, user_id, till_number, till_type,
               is_verified, api_connected, verification_method, created_at, updated_at
        FROM business_tills
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let tills: Vec<crate::models::BusinessTill> = rows
        .into_iter()
        .map(|row| crate::models::BusinessTill {
            id: row.get(0),
            user_id: row.get(1),
            till_number: row.get(2),
            till_type: row.get(3),
            is_verified: row.get(4),
            api_connected: row.get(5),
            verification_method: row.get(6),
            created_at: row.get(7),
            updated_at: row.get(8),
        })
        .collect();

    let response: Vec<TillResponse> = tills
        .into_iter()
        .map(|t| TillResponse {
            id: t.id.to_string(),
            till_number: t.till_number,
            till_type: format!("{:?}", t.till_type),
            is_verified: t.is_verified,
            api_connected: t.api_connected,
        })
        .collect();

    Ok(Json(response))
}
