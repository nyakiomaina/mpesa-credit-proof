use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub phone_number: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessTill {
    pub id: Uuid,
    pub user_id: Uuid,
    pub till_number: String,
    pub till_type: TillType,
    pub is_verified: bool,
    pub api_connected: bool,
    pub verification_method: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "till_type", rename_all = "PascalCase")]
pub enum TillType {
    BuyGoods,
    PayBill,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Transaction {
    pub id: Uuid,
    pub till_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub amount: i64, // In cents
    pub transaction_type: String,
    pub reference: String, // Hashed
    pub raw_data: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub till_id: Uuid,
    pub status: ProofStatus,
    pub progress: Option<i32>,
    pub credit_score: Option<i32>,
    pub metrics: Option<serde_json::Value>,
    pub receipt_data: Option<Vec<u8>>,
    pub verification_code: String,
    pub expires_at: DateTime<Utc>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "proof_status", rename_all = "lowercase")]
pub enum ProofStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessMetrics {
    pub monthly_volume_range: VolumeRange,
    pub consistency_score: u8,
    pub growth_trend: GrowthTrend,
    pub active_days_percentage: u8,
    pub customer_diversity_score: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VolumeRange {
    VeryLow,
    Low,
    Medium,
    High,
    VeryHigh,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GrowthTrend {
    Declining,
    Stable,
    Growing,
    Rapid,
}







