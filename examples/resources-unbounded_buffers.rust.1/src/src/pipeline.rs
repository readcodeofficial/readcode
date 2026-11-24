use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use futures::TryStreamExt;
use sqlx::PgPool;
use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::{error, info, warn};

use crate::api::PayrollApi;
use crate::model::PayslipRow;

const ROW_CHANNEL_CAPACITY: usize = 1_024;
const BATCH_SIZE: usize = 500;
const MAX_RETRY_ATTEMPTS: u32 = 5;
const MAX_BACKOFF: Duration = Duration::from_secs(60);

type Batch = Vec<PayslipRow>;

pub async fn run_export(pool: PgPool, api: Arc<PayrollApi>, period: String) -> anyhow::Result<()> {
    let (row_tx, mut row_rx) = mpsc::channel::<PayslipRow>(ROW_CHANNEL_CAPACITY);
    let (retry_tx, retry_rx) = mpsc::unbounded_channel::<Batch>();

    let producer = tokio::spawn(stream_rows(pool, period, row_tx));
    let retrier = tokio::spawn(retry_loop(Arc::clone(&api), retry_rx));

    let mut batch: Batch = Vec::with_capacity(BATCH_SIZE);
    let mut sent = 0usize;
    while let Some(row) = row_rx.recv().await {
        batch.push(row);
        if batch.len() == BATCH_SIZE {
            sent += batch.len();
            flush(&api, std::mem::take(&mut batch), &retry_tx).await;
        }
    }
    if !batch.is_empty() {
        sent += batch.len();
        flush(&api, batch, &retry_tx).await;
    }

    drop(retry_tx);
    producer.await.context("producer panicked")??;
    let abandoned = retrier.await.context("retry worker panicked")?;
    info!(rows = sent, abandoned, "export finished");

    if abandoned > 0 {
        anyhow::bail!("{abandoned} batches could not be delivered");
    }
    Ok(())
}

async fn stream_rows(pool: PgPool, period: String, tx: mpsc::Sender<PayslipRow>) -> anyhow::Result<()> {
    let mut rows = sqlx::query_as::<_, PayslipRow>(
        "SELECT employee_id, period, gross_cents, net_cents, cost_center \
         FROM payslips WHERE period = $1 ORDER BY employee_id",
    )
    .bind(period)
    .fetch(&pool);

    while let Some(row) = rows.try_next().await.context("reading payslips")? {
        if tx.send(row).await.is_err() {
            break;
        }
    }
    Ok(())
}

async fn flush(api: &PayrollApi, rows: Batch, retry_tx: &mpsc::UnboundedSender<Batch>) {
    if let Err(err) = api.submit(&rows).await {
        warn!(%err, rows = rows.len(), "batch rejected, queueing for retry");
        if retry_tx.send(rows).is_err() {
            error!("retry worker is gone, batch dropped");
        }
    }
}

async fn retry_loop(api: Arc<PayrollApi>, mut rx: mpsc::UnboundedReceiver<Batch>) -> usize {
    let mut abandoned = 0;
    while let Some(rows) = rx.recv().await {
        let mut delivered = false;
        for attempt in 1..=MAX_RETRY_ATTEMPTS {
            sleep(backoff(attempt)).await;
            match api.submit(&rows).await {
                Ok(()) => {
                    delivered = true;
                    break;
                }
                Err(err) => warn!(attempt, %err, "retry failed"),
            }
        }
        if !delivered {
            error!(rows = rows.len(), "batch abandoned after retries");
            abandoned += 1;
        }
    }
    abandoned
}

fn backoff(attempt: u32) -> Duration {
    Duration::from_millis(500u64 << attempt.min(10)).min(MAX_BACKOFF)
}
