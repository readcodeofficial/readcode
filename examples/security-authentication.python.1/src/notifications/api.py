from __future__ import annotations

import logging
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from .tokens import AuthError, Principal, TokenVerifier

log = logging.getLogger("notifications.auth")
router = APIRouter()
bearer = HTTPBearer(auto_error=False)

_UNAUTHORIZED = {"WWW-Authenticate": "Bearer"}


def get_verifier(request: Request) -> TokenVerifier:
    return request.app.state.token_verifier


def current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    verifier: TokenVerifier = Depends(get_verifier),
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required", headers=_UNAUTHORIZED)
    try:
        return verifier.verify(credentials.credentials)
    except AuthError as exc:
        log.info("rejected bearer token: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid credentials", headers=_UNAUTHORIZED)


def require_scope(scope: str) -> Callable[[Principal], Principal]:
    def dependency(principal: Principal = Depends(current_principal)) -> Principal:
        if scope not in principal.scopes:
            log.warning("subject %s lacks scope %s", principal.subject, scope)
            raise HTTPException(status_code=403, detail="Insufficient scope")
        return principal

    return dependency


class SendRequest(BaseModel):
    recipient_id: str = Field(min_length=1, max_length=64)
    template: str = Field(min_length=1, max_length=64)
    variables: dict[str, str] = Field(default_factory=dict, max_length=20)


@router.post("/v1/notifications", status_code=202)
async def send_notification(
    request: Request,
    body: SendRequest,
    principal: Principal = Depends(require_scope("notifications:send")),
) -> dict[str, str]:
    queued_id = await request.app.state.outbound_queue.enqueue(
        tenant_id=principal.tenant_id,
        recipient_id=body.recipient_id,
        template=body.template,
        variables=body.variables,
    )
    return {"id": queued_id}
