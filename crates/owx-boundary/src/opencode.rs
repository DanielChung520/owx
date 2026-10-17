use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum OpenCodeError {
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("unexpected opencode response")]
    Unexpected,
}

#[derive(Clone)]
pub struct OpenCodeClient {
    base: String,
    http: reqwest::Client,
}

impl OpenCodeClient {
    pub fn new(base: impl Into<String>) -> Self {
        Self {
            base: base.into(),
            http: reqwest::Client::new(),
        }
    }

    pub async fn create_session(&self) -> Result<String, OpenCodeError> {
        let res = self
            .http
            .post(format!("{}/session", self.base))
            .json(&json!({}))
            .send()
            .await?;
        if !res.status().is_success() {
            return Err(OpenCodeError::Unexpected);
        }
        let body: serde_json::Value = res.json().await?;
        body.get("id")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or(OpenCodeError::Unexpected)
    }

    pub async fn send_message(&self, session_id: &str, text: &str) -> Result<(), OpenCodeError> {
        let res = self
            .http
            .post(format!("{}/session/{session_id}/message", self.base))
            .json(&json!({ "parts": [{ "type": "text", "text": text }] }))
            .send()
            .await?;
        if !res.status().is_success() {
            return Err(OpenCodeError::Unexpected);
        }
        Ok(())
    }
}
