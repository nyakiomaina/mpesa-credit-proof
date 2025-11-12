pub mod auth;
pub mod data;
pub mod lender;
pub mod proofs;
pub mod tills;
pub mod verification;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use sqlx::PgPool;

use crate::config::Config;
use crate::utils::Claims;
use redis::Client;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: Client,
    pub config: std::sync::Arc<Config>,
}

#[axum::async_trait]
impl FromRequestParts<AppState> for Claims {
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &AppState) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Claims>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}

