use axum::{
    extract::{Multipart, State},
    Json,
};
use csv::ReaderBuilder;
use serde::Serialize;
use sqlx::Row;
use uuid::Uuid;

use crate::error::AppError;
use crate::handlers::{AppState, Claims};
use crate::utils::hash_phone_number;

#[derive(Serialize)]
pub struct UploadDataResponse {
    pub message: String,
    pub transactions_imported: usize,
}

pub async fn upload_data(
    State(state): State<AppState>,
    claims: Claims,
    mut multipart: Multipart,
) -> Result<Json<UploadDataResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.user_id)
        .map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?;
    let mut till_id: Option<Uuid> = None;
    let mut file_data: Option<Vec<u8>> = None;
    let mut file_type: Option<String> = None;

    // Parse multipart form
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::FileProcessing(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        let content_type = field.content_type().map(|s| s.to_string());

        if name == "till_id" {
            let value = field
                .text()
                .await
                .map_err(|e| AppError::FileProcessing(e.to_string()))?;
            till_id = Some(
                Uuid::parse_str(&value)
                    .map_err(|e| AppError::Validation(format!("Invalid UUID: {}", e)))?,
            );
        } else if name == "file" {
            let bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::FileProcessing(e.to_string()))?;
            file_data = Some(bytes.to_vec());
            file_type = content_type;
        }
    }

    let till_id = till_id.ok_or_else(|| AppError::Validation("Missing till_id".to_string()))?;
    let file_data = file_data.ok_or_else(|| AppError::Validation("Missing file".to_string()))?;

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

    // Process file based on type
    let transactions = if file_type.as_deref() == Some("text/csv")
        || file_type.as_deref() == Some("application/vnd.ms-excel")
    {
        parse_csv(&file_data)?
    } else if file_type.as_deref() == Some("application/pdf") {
        parse_pdf(&file_data)?
    } else {
        return Err(AppError::FileProcessing(
            "Unsupported file type. Please upload CSV or PDF".to_string(),
        ));
    };

    // Import transactions
    let mut imported = 0;
    for tx in transactions {
        // Hash phone numbers/references for privacy
        let hashed_reference = hash_phone_number(&tx.reference);

        // Insert transaction (ignore duplicates)
        let result = sqlx::query(
            r#"
            INSERT INTO transactions (till_id, timestamp, amount, transaction_type, reference)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (till_id, reference) DO NOTHING
            "#,
        )
        .bind(till_id)
        .bind(tx.timestamp)
        .bind(tx.amount)
        .bind(&tx.transaction_type)
        .bind(hashed_reference)
        .execute(&state.db)
        .await?;

        if result.rows_affected() > 0 {
            imported += 1;
        }
    }

    Ok(Json(UploadDataResponse {
        message: "Data uploaded successfully".to_string(),
        transactions_imported: imported,
    }))
}

struct ParsedTransaction {
    timestamp: chrono::DateTime<chrono::Utc>,
    amount: i64,
    transaction_type: String,
    reference: String,
}

fn parse_csv(data: &[u8]) -> Result<Vec<ParsedTransaction>, AppError> {
    let mut reader = ReaderBuilder::new().has_headers(true).from_reader(data);

    let mut transactions = Vec::new();

    for result in reader.records() {
        let record = result.map_err(|e| AppError::FileProcessing(e.to_string()))?;

        // Try to parse common CSV formats
        // Expected columns: Date, Amount, Type, Reference/Transaction ID
        if record.len() < 4 {
            continue;
        }

        let date_str = record.get(0).unwrap_or("");
        let amount_str = record.get(1).unwrap_or("");
        let tx_type = record.get(2).unwrap_or("Payment");
        let reference = record.get(3).unwrap_or("");

        // Parse date (try multiple formats)
        let timestamp = parse_date(date_str)?;

        // Parse amount (remove currency symbols, convert to cents)
        let amount = parse_amount(amount_str)?;

        transactions.push(ParsedTransaction {
            timestamp,
            amount,
            transaction_type: tx_type.to_string(),
            reference: reference.to_string(),
        });
    }

    Ok(transactions)
}

fn parse_pdf(_data: &[u8]) -> Result<Vec<ParsedTransaction>, AppError> {
    // TODO: Implement PDF parsing with OCR
    // For now, return error
    Err(AppError::FileProcessing(
        "PDF parsing not yet implemented. Please use CSV format.".to_string(),
    ))
}

fn parse_date(date_str: &str) -> Result<chrono::DateTime<chrono::Utc>, AppError> {
    // Try multiple date formats
    let formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d %H:%M:%S",
    ];

    for format in &formats {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(date_str, format) {
            return Ok(dt.and_utc());
        }
        if let Ok(d) = chrono::NaiveDate::parse_from_str(date_str, format) {
            return Ok(d.and_hms_opt(0, 0, 0).unwrap().and_utc());
        }
    }

    Err(AppError::FileProcessing(format!(
        "Unable to parse date: {}",
        date_str
    )))
}

fn parse_amount(amount_str: &str) -> Result<i64, AppError> {
    // Remove currency symbols and commas
    let cleaned: String = amount_str
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
        .collect();

    let amount: f64 = cleaned
        .parse()
        .map_err(|_| AppError::FileProcessing(format!("Unable to parse amount: {}", amount_str)))?;

    // Convert to cents
    Ok((amount * 100.0) as i64)
}
