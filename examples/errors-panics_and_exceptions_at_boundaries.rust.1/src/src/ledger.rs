use std::collections::HashMap;
use std::sync::{Mutex, PoisonError};

use crate::error::AppError;
use crate::model::ClickEvent;

pub struct BudgetLedger {
    rates_micros: HashMap<String, i64>,
    remaining_micros: Mutex<HashMap<String, i64>>,
}

impl BudgetLedger {
    pub fn new(rates_micros: HashMap<String, i64>, budgets: HashMap<String, i64>) -> Self {
        Self {
            rates_micros,
            remaining_micros: Mutex::new(budgets),
        }
    }

    pub fn price(&self, click: &ClickEvent) -> i64 {
        let rate = self.rates_micros[&click.placement];
        rate * i64::from(click.count)
    }

    pub fn charge(&self, campaign: &str, cost: i64) -> Result<(), AppError> {
        let mut budgets = self
            .remaining_micros
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let remaining = budgets
            .get_mut(campaign)
            .ok_or_else(|| AppError::UnknownCampaign(campaign.to_string()))?;
        if *remaining < cost {
            return Err(AppError::BudgetExhausted(campaign.to_string()));
        }
        *remaining -= cost;
        Ok(())
    }

    pub fn refund(&self, campaign: &str, cost: i64) {
        let mut budgets = self
            .remaining_micros
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        if let Some(remaining) = budgets.get_mut(campaign) {
            *remaining += cost;
        }
    }
}
