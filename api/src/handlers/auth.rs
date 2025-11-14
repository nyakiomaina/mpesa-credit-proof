use axum::{extract::State, Json};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::handlers::AppState;
use crate::services::auth::AuthService;
use crate::utils::{generate_jwt, hash_phone_number};

#[derive(Deserialize)]
pub struct RequestOtpRequest {
    pub phone_number: String,
}

#[derive(Serialize)]
pub struct RequestOtpResponse {
    pub message: String,
    pub expires_in: u64,
}

#[derive(Deserialize)]
pub struct VerifyOtpRequest {
    pub phone_number: String,
    pub otp: String,
}

#[derive(Serialize)]
pub struct VerifyOtpResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: String,
    pub phone_number: String,
}

pub async fn request_otp(
    State(state): State<AppState>,
    Json(req): Json<RequestOtpRequest>,
) -> Result<Json<RequestOtpResponse>, AppError> {
    // Rate limiting: 3 requests per hour
    let redis_key = format!("otp:rate:{}", hash_phone_number(&req.phone_number));
    let mut redis_conn = state.redis.get_async_connection().await?;

    let attempts: i32 = redis_conn.get(&redis_key).await.unwrap_or(0);
    if attempts >= 3 {
        return Err(AppError::RateLimit);
    }

    // Generate 6-digit OTP
    let otp = AuthService::generate_otp();

    // Store OTP in Redis with 5-minute TTL
    let otp_key = format!("otp:{}", hash_phone_number(&req.phone_number));
    redis_conn.set_ex(&otp_key, &otp, 300).await?; // 5 minutes

    // Increment rate limit counter
    redis_conn.incr(&redis_key, 1).await?;
    redis_conn.expire(&redis_key, 3600).await?; // 1 hour

    // Send SMS via Africa's Talking
    AuthService::send_sms(
        &state.config.africa_talking_api_key,
        &state.config.africa_talking_username,
        &req.phone_number,
        &format!("Your verification code is: {}", otp),
    )
    .await?;

    Ok(Json(RequestOtpResponse {
        message: "OTP sent".to_string(),
        expires_in: 300,
    }))
}

pub async fn verify_otp(
    State(state): State<AppState>,
    Json(req): Json<VerifyOtpRequest>,
) -> Result<Json<VerifyOtpResponse>, AppError> {
    let mut redis_conn = state.redis.get_async_connection().await?;
    let otp_key = format!("otp:{}", hash_phone_number(&req.phone_number));

    let stored_otp: Option<String> = redis_conn.get(&otp_key).await?;

    if stored_otp.as_deref() != Some(&req.otp) {
        return Err(AppError::InvalidOtp);
    }

    // Delete OTP after successful verification
    redis_conn.del(&otp_key).await?;

    // Get or create user
    let user = sqlx::query_as::<_, crate::models::User>(
        r#"
        INSERT INTO users (phone_number)
        VALUES ($1)
        ON CONFLICT (phone_number) DO UPDATE SET updated_at = NOW()
        RETURNING id, phone_number, created_at, updated_at
        "#,
    )
    .bind(&req.phone_number)
    .fetch_one(&state.db)
    .await?;

    // Generate JWT token
    let token = generate_jwt(user.id, &user.phone_number, &state.config.jwt_secret)?;

    Ok(Json(VerifyOtpResponse {
        token,
        user: UserResponse {
            id: user.id.to_string(),
            phone_number: user.phone_number,
        },
    }))
}
