use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("invalid click event: {0}")]
    Invalid(String),
    #[error("campaign {0} is unknown")]
    UnknownCampaign(String),
    #[error("campaign {0} has no budget left")]
    BudgetExhausted(String),
    #[error("storage failure")]
    Storage(#[from] sqlx::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Invalid(_) => (StatusCode::UNPROCESSABLE_ENTITY, self.to_string()),
            AppError::UnknownCampaign(_) => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::BudgetExhausted(_) => (StatusCode::PAYMENT_REQUIRED, self.to_string()),
            AppError::Storage(err) => {
                tracing::error!(error = %err, "click storage failed");
                (StatusCode::SERVICE_UNAVAILABLE, "storage unavailable".to_string())
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
