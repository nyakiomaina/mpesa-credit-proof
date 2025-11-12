
#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub bind_address: String,
    pub jwt_secret: String,
    pub africa_talking_api_key: String,
    pub africa_talking_username: String,
    pub daraja_consumer_key: Option<String>,
    pub daraja_consumer_secret: Option<String>,
    pub daraja_shortcode: Option<String>,
    pub bonsai_api_key: Option<String>,
    pub bonsai_api_url: Option<String>,
    pub storage_type: String, // "local", "s3", "r2"
    pub storage_bucket: Option<String>,
    pub storage_region: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Config {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/mpesa_credit".to_string()),
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            bind_address: std::env::var("BIND_ADDRESS")
                .unwrap_or_else(|_| "0.0.0.0:3000".to_string()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-secret-key-change-in-production".to_string()),
            africa_talking_api_key: std::env::var("AFRICA_TALKING_API_KEY")
                .expect("AFRICA_TALKING_API_KEY must be set"),
            africa_talking_username: std::env::var("AFRICA_TALKING_USERNAME")
                .expect("AFRICA_TALKING_USERNAME must be set"),
            daraja_consumer_key: std::env::var("DARAJACONSUMER_KEY").ok(),
            daraja_consumer_secret: std::env::var("DARAJACONSUMER_SECRET").ok(),
            daraja_shortcode: std::env::var("DARAJASHORTCODE").ok(),
            bonsai_api_key: std::env::var("BONSAI_API_KEY").ok(),
            bonsai_api_url: std::env::var("BONSAI_API_URL").ok(),
            storage_type: std::env::var("STORAGE_TYPE")
                .unwrap_or_else(|_| "local".to_string()),
            storage_bucket: std::env::var("STORAGE_BUCKET").ok(),
            storage_region: std::env::var("STORAGE_REGION").ok(),
        })
    }
}

