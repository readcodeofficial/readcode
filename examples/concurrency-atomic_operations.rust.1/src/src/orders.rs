use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use crate::inventory::{Inventory, ReserveError};

#[derive(Debug, Clone)]
pub struct OrderLine {
    pub sku: String,
    pub qty: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OrderId(pub u64);

#[derive(Debug, PartialEq, Eq)]
pub enum OrderError {
    Draining,
    EmptyOrder,
    Stock(ReserveError),
}

pub struct OrderService {
    inventory: Arc<Inventory>,
    next_id: AtomicU64,
    draining: AtomicBool,
    placed: AtomicU64,
}

impl OrderService {
    pub fn new(inventory: Arc<Inventory>) -> Self {
        OrderService {
            inventory,
            next_id: AtomicU64::new(1000),
            draining: AtomicBool::new(false),
            placed: AtomicU64::new(0),
        }
    }

    pub fn place_order(&self, lines: &[OrderLine]) -> Result<OrderId, OrderError> {
        if self.draining.load(Ordering::Acquire) {
            return Err(OrderError::Draining);
        }
        if lines.is_empty() {
            return Err(OrderError::EmptyOrder);
        }

        let mut reserved: Vec<&OrderLine> = Vec::with_capacity(lines.len());
        for line in lines {
            match self.inventory.reserve(&line.sku, line.qty) {
                Ok(()) => reserved.push(line),
                Err(err) => {
                    for done in &reserved {
                        self.inventory.release(&done.sku, done.qty);
                    }
                    return Err(OrderError::Stock(err));
                }
            }
        }

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        self.placed.fetch_add(1, Ordering::Relaxed);
        Ok(OrderId(id))
    }

    pub fn cancel_order(&self, lines: &[OrderLine]) {
        for line in lines {
            self.inventory.release(&line.sku, line.qty);
        }
    }

    pub fn start_draining(&self) {
        self.draining.store(true, Ordering::Release);
    }

    pub fn placed_count(&self) -> u64 {
        self.placed.load(Ordering::Relaxed)
    }
}
