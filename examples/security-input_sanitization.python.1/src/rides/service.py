import logging
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from rides.schemas import SORT_COLUMNS, RideRequest

log = logging.getLogger("rides")

RECEIPT_DIR = Path("/var/lib/rides/receipts").resolve()


class PromoRejected(Exception):
    pass


class InvalidSort(ValueError):
    pass


def create_ride(session: Session, req: RideRequest) -> int:
    discount_pct = 0
    if req.promo_code:
        discount_pct = _lookup_promo(session, req)

    row = session.execute(
        text(
            "INSERT INTO rides (rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, note, discount_pct) "
            "VALUES (:rider, :plat, :plng, :dlat, :dlng, :note, :discount) RETURNING id"
        ),
        {
            "rider": req.rider_id,
            "plat": req.pickup.lat,
            "plng": req.pickup.lng,
            "dlat": req.dropoff.lat,
            "dlng": req.dropoff.lng,
            "note": req.pickup_note,
            "discount": discount_pct,
        },
    ).one()
    return row.id


def _lookup_promo(session: Session, req: RideRequest) -> int:
    row = session.execute(
        text("SELECT discount_pct FROM promos WHERE code = :code AND expires_at > now()"),
        {"code": req.promo_code},
    ).first()
    if row is None:
        log.warning("promo rejected code=%s rider=%s", req.promo_code, req.rider_id)
        raise PromoRejected(req.promo_code)
    log.info("promo applied code=%s rider=%s discount=%s", req.promo_code, req.rider_id, row.discount_pct)
    return row.discount_pct


def ride_history(session: Session, rider_id, sort: str, limit: int = 50):
    column = SORT_COLUMNS.get(sort)
    if column is None:
        raise InvalidSort(sort)
    query = text(f"SELECT id, fare_cents, distance_m, requested_at FROM rides WHERE rider_id = :rider ORDER BY {column} DESC LIMIT :limit")
    return session.execute(query, {"rider": rider_id, "limit": min(limit, 200)}).all()


def receipt_path(name: str) -> Path | None:
    candidate = (RECEIPT_DIR / name).resolve()
    if not candidate.is_relative_to(RECEIPT_DIR) or not candidate.is_file():
        return None
    return candidate
