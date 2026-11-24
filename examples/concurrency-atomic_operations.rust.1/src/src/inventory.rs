use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};

#[derive(Debug, PartialEq, Eq)]
pub enum ReserveError {
    UnknownSku(String),
    Insufficient { sku: String, available: u32 },
}

struct StockLevel {
    available: AtomicU32,
    capacity: u32,
}

pub struct Inventory {
    levels: HashMap<String, StockLevel>,
    reservations: AtomicU64,
}

impl Inventory {
    pub fn new(initial: impl IntoIterator<Item = (String, u32)>) -> Self {
        let levels = initial
            .into_iter()
            .map(|(sku, qty)| {
                let level = StockLevel {
                    available: AtomicU32::new(qty),
                    capacity: qty,
                };
                (sku, level)
            })
            .collect();
        Inventory {
            levels,
            reservations: AtomicU64::new(0),
        }
    }

    pub fn reserve(&self, sku: &str, qty: u32) -> Result<(), ReserveError> {
        let level = self
            .levels
            .get(sku)
            .ok_or_else(|| ReserveError::UnknownSku(sku.to_string()))?;

        let previous = level.available.fetch_sub(qty, Ordering::AcqRel);
        if previous < qty {
            level.available.fetch_add(qty, Ordering::AcqRel);
            return Err(ReserveError::Insufficient {
                sku: sku.to_string(),
                available: previous,
            });
        }

        self.reservations.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }

    pub fn release(&self, sku: &str, qty: u32) {
        if let Some(level) = self.levels.get(sku) {
            let _ = level
                .available
                .fetch_update(Ordering::AcqRel, Ordering::Acquire, |current| {
                    Some(current.saturating_add(qty).min(level.capacity))
                });
        }
    }

    pub fn available(&self, sku: &str) -> Option<u32> {
        self.levels
            .get(sku)
            .map(|level| level.available.load(Ordering::Acquire))
    }

    pub fn reservation_count(&self) -> u64 {
        self.reservations.load(Ordering::Relaxed)
    }
}
