use std::time::Duration;

use reqwest::Client;

use crate::model::PayslipRow;

pub struct PayrollApi {
    client: Client,
    url: String,
}

impl PayrollApi {
    pub fn new(url: String) -> reqwest::Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(3))
            .build()?;
        Ok(Self { client, url })
    }

    pub async fn submit(&self, rows: &[PayslipRow]) -> reqwest::Result<()> {
        self.client
            .post(&self.url)
            .json(rows)
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }
}
