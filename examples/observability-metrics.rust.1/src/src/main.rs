mod http;
mod metrics;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::metrics::SCANS_INGESTED;

#[derive(Clone, Serialize, Deserialize)]
struct Scan {
    scan_id: String,
    facility: String,
    status: String,
}

#[derive(Default)]
struct Store {
    scans: Mutex<HashMap<String, Vec<Scan>>>,
}

type Shared = Arc<Store>;

async fn list_scans(
    State(store): State<Shared>,
    Path(shipment_id): Path<String>,
) -> Result<Json<Vec<Scan>>, StatusCode> {
    let scans = store.scans.lock().unwrap_or_else(|e| e.into_inner());
    scans
        .get(&shipment_id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn ingest_scan(
    State(store): State<Shared>,
    Path(shipment_id): Path<String>,
    Json(scan): Json<Scan>,
) -> StatusCode {
    if scan.scan_id.is_empty() || scan.facility.is_empty() {
        SCANS_INGESTED.with_label_values(&["rejected"]).inc();
        return StatusCode::UNPROCESSABLE_ENTITY;
    }

    let mut scans = store.scans.lock().unwrap_or_else(|e| e.into_inner());
    let history = scans.entry(shipment_id).or_default();
    if history.iter().any(|s| s.scan_id == scan.scan_id) {
        SCANS_INGESTED.with_label_values(&["duplicate"]).inc();
        return StatusCode::OK;
    }
    history.push(scan);
    SCANS_INGESTED.with_label_values(&["accepted"]).inc();
    StatusCode::CREATED
}

#[tokio::main]
async fn main() {
    metrics::init();

    let app = Router::new()
        .route("/shipments/:id/scans", get(list_scans).post(ingest_scan))
        .route("/metrics", get(|| async { metrics::render() }))
        .layer(middleware::from_fn(http::track))
        .with_state(Shared::default());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("bind 0.0.0.0:8080");
    axum::serve(listener, app).await.expect("server error");
}
