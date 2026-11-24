use axum::async_trait;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use uuid::Uuid;

use crate::models::Role;

#[derive(Debug, Clone)]
pub struct Caller {
    pub user_id: Uuid,
    pub roles: Vec<Role>,
}

impl Caller {
    pub fn has_role(&self, role: Role) -> bool {
        self.roles.contains(&role)
    }
}

#[async_trait]
impl<S: Send + Sync> FromRequestParts<S> for Caller {
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Caller>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}
