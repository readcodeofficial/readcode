use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Member,
    Auditor,
    Admin,
}

#[derive(Debug, Clone, Serialize)]
pub struct UserRecord {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    pub roles: Vec<Role>,
    #[serde(skip_serializing)]
    pub password_hash: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateUserRequest {
    pub email: String,
    pub display_name: String,
    pub password: String,
}

#[derive(Debug, Default, Deserialize)]
pub struct ProfileUpdate {
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub roles: Option<Vec<Role>>,
}

impl UserRecord {
    pub fn apply(&mut self, update: ProfileUpdate) {
        if let Some(email) = update.email {
            self.email = email.trim().to_lowercase();
        }
        if let Some(name) = update.display_name {
            self.display_name = name.trim().to_string();
        }
        if let Some(roles) = update.roles {
            self.roles = roles;
        }
    }
}
