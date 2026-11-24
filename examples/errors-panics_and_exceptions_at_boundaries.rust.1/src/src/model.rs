use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ClickEvent {
    pub campaign_id: String,
    pub placement: String,
    pub count: u32,
}
