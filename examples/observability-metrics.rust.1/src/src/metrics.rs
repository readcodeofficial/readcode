use once_cell::sync::Lazy;
use prometheus::{
    register_histogram_vec, register_int_counter_vec, register_int_gauge, Encoder, HistogramVec,
    IntCounterVec, IntGauge, TextEncoder,
};

pub static HTTP_REQUESTS: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "tracking_http_requests_total",
        "HTTP requests handled by the tracking API",
        &["method", "route", "status"]
    )
    .expect("register tracking_http_requests_total")
});

pub static HTTP_LATENCY: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "tracking_http_request_duration_seconds",
        "Time spent handling a request",
        &["method", "route"],
        vec![0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]
    )
    .expect("register tracking_http_request_duration_seconds")
});

pub static IN_FLIGHT: Lazy<IntGauge> = Lazy::new(|| {
    register_int_gauge!("tracking_http_in_flight_requests", "Requests currently being handled")
        .expect("register tracking_http_in_flight_requests")
});

pub static SCANS_INGESTED: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!(
        "tracking_scans_ingested_total",
        "Parcel scans received, by outcome",
        &["result"]
    )
    .expect("register tracking_scans_ingested_total")
});

pub fn init() {
    Lazy::force(&HTTP_REQUESTS);
    Lazy::force(&HTTP_LATENCY);
    Lazy::force(&IN_FLIGHT);
    Lazy::force(&SCANS_INGESTED);
}

pub fn render() -> String {
    let mut buf = Vec::new();
    TextEncoder::new()
        .encode(&prometheus::gather(), &mut buf)
        .expect("encode metrics");
    String::from_utf8(buf).unwrap_or_default()
}
