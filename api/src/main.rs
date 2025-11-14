// Modules are defined in lib.rs

use api::handlers;
use api::middleware;
use axum::{
    http::StatusCode,
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "api=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenv::dotenv().ok();

    let config = api::config::Config::from_env()?;
    let bind_address = config.bind_address.clone();
    let pool = api::db::create_pool(&config.database_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    // Initialize Redis connection
    let redis_client = redis::Client::open(config.redis_url.as_str())?;

    // Build application state
    let app_state = handlers::AppState {
        db: pool,
        redis: redis_client,
        config: std::sync::Arc::new(config),
    };

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/request-otp", post(handlers::auth::request_otp))
        .route("/api/auth/verify-otp", post(handlers::auth::verify_otp))
        .route(
            "/api/tills/register",
            post(handlers::tills::register_till),
        )
        .route("/api/tills/verify", post(handlers::tills::verify_till))
        .route("/api/tills", get(handlers::tills::list_tills))
        .route("/api/proofs/generate", post(handlers::proofs::generate_proof))
        .route("/api/proofs/generate-direct", post(handlers::proofs::generate_direct))
        .route("/api/data/upload", post(handlers::data::upload_data))
        .route(
            "/api/proofs/status/:session_id",
            get(handlers::proofs::get_proof_status),
        )
        .route(
            "/api/proofs/result/:session_id",
            get(handlers::proofs::get_proof_result),
        )
        .route("/api/proofs", get(handlers::proofs::list_proofs))
        .route("/api/lender/verify", post(handlers::lender::verify_proof))
        .route(
            "/api/lender/bulk-verify",
            get(handlers::lender::bulk_verify),
        )
        .route("/verify/:code", get(handlers::verification::verify_code))
        .layer(
            axum::middleware::from_fn_with_state(
                app_state.clone(),
                api::middleware::auth::auth_middleware,
            ),
        )
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind(&bind_address).await?;
    tracing::info!("Server listening on {}", bind_address);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}

