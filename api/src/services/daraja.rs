use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct DarajaService;

#[derive(Serialize)]
struct TokenRequest {
    grant_type: String,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: String,
}

impl DarajaService {
    pub async fn get_access_token(
        consumer_key: &str,
        consumer_secret: &str,
    ) -> anyhow::Result<String> {
        let client = Client::new();
        let url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

        use base64::Engine;
        let auth = base64::engine::general_purpose::STANDARD
            .encode(format!("{}:{}", consumer_key, consumer_secret));

        let response = client
            .get(url)
            .header("Authorization", format!("Basic {}", auth))
            .send()
            .await?;

        let token_response: TokenResponse = response.json().await?;
        Ok(token_response.access_token)
    }

    pub async fn register_c2b_url(
        access_token: &str,
        shortcode: &str,
        confirmation_url: &str,
        validation_url: &str,
    ) -> anyhow::Result<()> {
        let client = Client::new();
        let url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl";

        #[derive(Serialize)]
        struct RegisterRequest {
            ShortCode: String,
            ResponseType: String,
            ConfirmationURL: String,
            ValidationURL: String,
        }

        let request = RegisterRequest {
            ShortCode: shortcode.to_string(),
            ResponseType: "Completed".to_string(),
            ConfirmationURL: confirmation_url.to_string(),
            ValidationURL: validation_url.to_string(),
        };

        let response = client
            .post(url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("Daraja API error: {}", error_text);
        }

        Ok(())
    }
}

