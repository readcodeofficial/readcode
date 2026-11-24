import logging
import time
import uuid

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel

from cdn_signer import CdnSigner, CdnSigningError
from logging_setup import configure_logging

configure_logging()
log = logging.getLogger("streamhub.playback")
app = FastAPI()
router = APIRouter(prefix="/v1/playback")


class StartRequest(BaseModel):
    title_id: str
    device_id: str


class StartResponse(BaseModel):
    session_id: str
    manifest_url: str
    license_token: str


def get_signer(request: Request) -> CdnSigner:
    return request.app.state.signer


async def current_user(request: Request) -> str:
    token = request.headers.get("authorization", "")
    user_id = await request.app.state.sessions.resolve(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="invalid session")
    return user_id


@app.middleware("http")
async def access_log(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    log.info(
        "request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000, 1),
        },
    )
    return response


@router.post("/start", response_model=StartResponse)
async def start_playback(
    body: StartRequest,
    request: Request,
    user_id: str = Depends(current_user),
    signer: CdnSigner = Depends(get_signer),
):
    entitlement = await request.app.state.entitlements.check(user_id, body.title_id)
    if not entitlement.allowed:
        log.warning(
            "playback denied",
            extra={"user_id": user_id, "title_id": body.title_id, "reason": entitlement.reason},
        )
        raise HTTPException(status_code=403, detail=entitlement.reason)

    try:
        license_token = await signer.issue_license(body.title_id, user_id, body.device_id)
    except CdnSigningError:
        log.error(
            "playback start failed",
            extra={"user_id": user_id, "title_id": body.title_id, "request_headers": dict(request.headers)},
        )
        raise HTTPException(status_code=502, detail="license unavailable")

    session_id = uuid.uuid4().hex
    log.info(
        "playback started",
        extra={"session_id": session_id, "user_id": user_id, "title_id": body.title_id, "device_id": body.device_id},
    )
    return StartResponse(
        session_id=session_id,
        manifest_url=signer.signed_manifest_url(body.title_id),
        license_token=license_token,
    )


app.include_router(router)
