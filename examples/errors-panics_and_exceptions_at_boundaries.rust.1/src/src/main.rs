use std::any::Any;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use sqlx::PgPool;
use tower_http::{catch_panic::CatchPanicLayer, timeout::TimeoutLayer};

mod error;
mod ledger;
mod model;

use error::AppError;
use ledger::BudgetLedger;
use model::ClickEvent;

pub struct AppState {
    pub ledger: BudgetLedger,
    pub pool: PgPool,
}

fn handle_panic(err: Box<dyn Any + Send + 'static>) -> Response {
    let detail = err
        .downcast_ref::<String>()
        .map(String::as_str)
        .or_else(|| err.downcast_ref::<&str>().copied())
        .unwrap_or("unknown panic");
    tracing::error!(panic = detail, "request handler panicked");
    (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/v1/clicks", post(record_click))
        .layer(TimeoutLayer::new(Duration::from_secs(2)))
        .layer(CatchPanicLayer::custom(handle_panic))
        .with_state(state)
}

async fn record_click(
    State(app): State<Arc<AppState>>,
    Json(click): Json<ClickEvent>,
) -> Result<StatusCode, AppError> {
    if click.count == 0 || click.count > 500 {
        return Err(AppError::Invalid("count must be between 1 and 500".into()));
    }

    let cost = app.ledger.price(&click);
    app.ledger.charge(&click.campaign_id, cost)?;

    let inserted = sqlx::query(
        "INSERT INTO clicks (campaign_id, placement, click_count, cost_micros) VALUES ($1, $2, $3, $4)",
    )
    .bind(&click.campaign_id)
    .bind(&click.placement)
    .bind(i32::try_from(click.count).unwrap_or(i32::MAX))
    .bind(cost)
    .execute(&app.pool)
    .await;

    if let Err(err) = inserted {
        app.ledger.refund(&click.campaign_id, cost);
        return Err(AppError::from(err));
    }
    Ok(StatusCode::ACCEPTED)
}
