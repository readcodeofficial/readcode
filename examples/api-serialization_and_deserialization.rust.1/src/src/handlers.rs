use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{patch, post};
use axum::{Json, Router};
use uuid::Uuid;

use crate::auth::Caller;
use crate::models::{CreateUserRequest, ProfileUpdate, Role, UserRecord};
use crate::store::{StoreError, UserStore};

pub struct AppState {
    pub users: Arc<dyn UserStore>,
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/users", post(create_user))
        .route("/users/me", patch(update_me))
        .route("/users/:id", patch(update_user))
        .with_state(state)
}

async fn create_user(
    State(state): State<Arc<AppState>>,
    caller: Caller,
    Json(body): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<UserRecord>), StatusCode> {
    if !caller.has_role(Role::Admin) {
        return Err(StatusCode::FORBIDDEN);
    }
    let record = state
        .users
        .create(&body.email, &body.display_name, &body.password)
        .await
        .map_err(map_store_error)?;
    Ok((StatusCode::CREATED, Json(record)))
}

async fn update_me(
    State(state): State<Arc<AppState>>,
    caller: Caller,
    Json(body): Json<ProfileUpdate>,
) -> Result<Json<UserRecord>, StatusCode> {
    let mut user = state
        .users
        .get(caller.user_id)
        .await
        .map_err(map_store_error)?;
    user.apply(body);
    state.users.save(&user).await.map_err(map_store_error)?;
    Ok(Json(user))
}

async fn update_user(
    State(state): State<Arc<AppState>>,
    caller: Caller,
    Path(id): Path<Uuid>,
    Json(body): Json<ProfileUpdate>,
) -> Result<Json<UserRecord>, StatusCode> {
    if !caller.has_role(Role::Admin) {
        return Err(StatusCode::FORBIDDEN);
    }
    let mut user = state.users.get(id).await.map_err(map_store_error)?;
    user.apply(body);
    state.users.save(&user).await.map_err(map_store_error)?;
    Ok(Json(user))
}

fn map_store_error(err: StoreError) -> StatusCode {
    match err {
        StoreError::NotFound => StatusCode::NOT_FOUND,
        StoreError::Conflict => StatusCode::CONFLICT,
        StoreError::Backend(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
