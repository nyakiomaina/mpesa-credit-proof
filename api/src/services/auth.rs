use rand::Rng;
use reqwest::Client;

pub struct AuthService;

impl AuthService {
    pub fn generate_otp() -> String {
        let mut rng = rand::thread_rng();
        format!("{:06}", rng.gen_range(100000..999999))
    }

    pub async fn send_sms(
        api_key: &str,
        username: &str,
        phone_number: &str,
        message: &str,
    ) -> anyhow::Result<()> {
        let client = Client::new();
        let url = "https://api.africastalking.com/version1/messaging";

        let response = client
            .post(url)
            .header("apiKey", api_key)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&[
                ("username", username),
                ("to", phone_number),
                ("message", message),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("Africa's Talking API error: {}", error_text);
        }

        Ok(())
    }
}







