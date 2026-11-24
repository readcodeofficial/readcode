from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from rides import service
from rides.db import get_session
from rides.schemas import RideRequest

router = APIRouter(prefix="/v1")


@router.post("/rides", status_code=201)
def request_ride(req: RideRequest, session=Depends(get_session)):
    try:
        ride_id = service.create_ride(session, req)
    except service.PromoRejected:
        raise HTTPException(status_code=422, detail="promo code is not valid")
    session.commit()
    return {"id": ride_id}


@router.get("/riders/{rider_id}/rides")
def history(rider_id: str, sort: str = "requested", session=Depends(get_session)):
    try:
        rows = service.ride_history(session, rider_id, sort)
    except service.InvalidSort:
        raise HTTPException(status_code=400, detail="unsupported sort")
    return [dict(r._mapping) for r in rows]


@router.get("/receipts/{name:path}")
def receipt(name: str):
    path = service.receipt_path(name)
    if path is None:
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type="application/pdf")
