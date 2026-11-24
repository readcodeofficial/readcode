use std::time::Instant;

use axum::{extract::Request, middleware::Next, response::Response};

use crate::metrics::{HTTP_LATENCY, HTTP_REQUESTS, IN_FLIGHT};

struct InFlightGuard;

impl InFlightGuard {
    fn enter() -> Self {
        IN_FLIGHT.inc();
        InFlightGuard
    }
}

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        IN_FLIGHT.dec();
    }
}

pub async fn track(req: Request, next: Next) -> Response {
    let _guard = InFlightGuard::enter();
    let method = req.method().to_string();
    let route = req.uri().path().to_owned();
    let started = Instant::now();

    let response = next.run(req).await;

    let status = response.status().as_u16().to_string();
    HTTP_REQUESTS
        .with_label_values(&[method.as_str(), route.as_str(), status.as_str()])
        .inc();
    HTTP_LATENCY
        .with_label_values(&[method.as_str(), route.as_str()])
        .observe(started.elapsed().as_secs_f64());

    response
}
