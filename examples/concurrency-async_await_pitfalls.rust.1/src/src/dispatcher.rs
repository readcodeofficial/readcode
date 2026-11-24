use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::{mpsc, Semaphore};
use tokio::task::JoinSet;
use tokio::time::timeout;
use tokio_util::sync::CancellationToken;

use crate::pool::{DriverId, DriverPool};

const OFFER_TIMEOUT: Duration = Duration::from_secs(12);

pub struct RideRequest {
    pub ride_id: u64,
    pub pickup: (f64, f64),
}

#[derive(Debug)]
pub enum DispatchError {
    NoDriversAvailable,
    AttemptsExhausted,
}

#[async_trait]
pub trait OfferGateway: Send + Sync {
    async fn send_offer(&self, driver: DriverId, ride_id: u64) -> Result<bool, std::io::Error>;
}

struct Reservation {
    pool: Arc<DriverPool>,
    driver: DriverId,
    ride_id: u64,
    armed: bool,
}

impl Reservation {
    fn disarm(mut self) {
        self.armed = false;
    }
}

impl Drop for Reservation {
    fn drop(&mut self) {
        if self.armed {
            self.pool.release(self.driver, self.ride_id);
        }
    }
}

pub struct Dispatcher<G> {
    pool: Arc<DriverPool>,
    gateway: Arc<G>,
    max_attempts: usize,
    max_in_flight: usize,
}

impl<G: OfferGateway + 'static> Dispatcher<G> {
    pub fn new(pool: Arc<DriverPool>, gateway: Arc<G>, max_attempts: usize, max_in_flight: usize) -> Self {
        Self { pool, gateway, max_attempts, max_in_flight }
    }

    pub async fn dispatch(&self, req: &RideRequest) -> Result<DriverId, DispatchError> {
        for _ in 0..self.max_attempts {
            let Some(driver) = self.pool.reserve_nearest(req.ride_id, req.pickup) else {
                return Err(DispatchError::NoDriversAvailable);
            };
            let reservation = Reservation {
                pool: Arc::clone(&self.pool),
                driver,
                ride_id: req.ride_id,
                armed: true,
            };

            let answer = timeout(OFFER_TIMEOUT, self.gateway.send_offer(driver, req.ride_id)).await;
            if let Ok(Ok(true)) = answer {
                if self.pool.confirm(driver, req.ride_id) {
                    reservation.disarm();
                    return Ok(driver);
                }
            }
        }
        Err(DispatchError::AttemptsExhausted)
    }

    pub async fn run(self: Arc<Self>, mut rx: mpsc::Receiver<RideRequest>, shutdown: CancellationToken) {
        let permits = Arc::new(Semaphore::new(self.max_in_flight));
        let mut tasks = JoinSet::new();

        loop {
            while let Some(finished) = tasks.try_join_next() {
                if let Err(err) = finished {
                    tracing::error!(%err, "dispatch task failed");
                }
            }

            let permit = tokio::select! {
                biased;
                _ = shutdown.cancelled() => break,
                p = Arc::clone(&permits).acquire_owned() => p.expect("semaphore is never closed"),
            };
            let req = tokio::select! {
                biased;
                _ = shutdown.cancelled() => break,
                next = rx.recv() => match next {
                    Some(req) => req,
                    None => break,
                },
            };

            let this = Arc::clone(&self);
            tasks.spawn(async move {
                let _permit = permit;
                match this.dispatch(&req).await {
                    Ok(driver) => tracing::info!(ride = req.ride_id, driver = driver.0, "ride assigned"),
                    Err(err) => tracing::warn!(ride = req.ride_id, ?err, "ride not assigned"),
                }
            });
        }

        if shutdown.is_cancelled() {
            tasks.shutdown().await;
        } else {
            while tasks.join_next().await.is_some() {}
        }
    }
}
