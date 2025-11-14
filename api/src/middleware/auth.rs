use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::handlers::AppState;
use crate::utils::verify_jwt;

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip auth for public endpoints
    let path = request.uri().path();
    let public_paths = [
        "/health",
        "/api/auth/request-otp",
        "/api/auth/verify-otp",
        "/api/proofs/generate-direct",
        "/api/proofs/status/",
        "/api/proofs/result/",
    ];

    if public_paths.iter().any(|p| path.starts_with(p)) {
        return Ok(next.run(request).await);
    }

    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = &auth_header[7..];

    match verify_jwt(token, &state.config.jwt_secret) {
        Ok(claims) => {
            // Store claims in request extensions for handlers to use
            request.extensions_mut().insert(claims);
            Ok(next.run(request).await)
        }
        Err(_) => Err(StatusCode::UNAUTHORIZED),
    }
}

