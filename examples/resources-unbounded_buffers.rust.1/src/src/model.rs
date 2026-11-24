use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct PayslipRow {
    pub employee_id: String,
    pub period: String,
    pub gross_cents: i64,
    pub net_cents: i64,
    pub cost_center: String,
}
