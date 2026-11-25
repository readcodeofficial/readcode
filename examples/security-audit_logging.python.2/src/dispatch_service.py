from sqlalchemy.orm import Session

from audit import AuditLog, Principal
from models import Driver, Ride, SurgeZone

MAX_SURGE_CAP = 5.0


class PermissionDenied(Exception):
    pass


class DispatchService:
    def __init__(self, session: Session, audit: AuditLog) -> None:
        self._session = session
        self._audit = audit

    def suspend_driver(self, principal: Principal, driver_id: int, reason: str) -> None:
        self._require(principal, "driver.suspend", f"driver:{driver_id}", "ops_admin")
        reason = reason.strip()
        if not reason:
            raise ValueError("a reason is required")

        driver = self._session.get(Driver, driver_id, with_for_update=True)
        if driver is None:
            raise LookupError(f"driver {driver_id} not found")

        previous = driver.status
        driver.status = "suspended"
        self._audit.record(
            self._session,
            principal,
            "driver.suspended",
            f"driver:{driver.id}",
            {"from": previous, "to": "suspended", "reason": reason},
        )
        self._session.commit()

    def reassign_ride(
        self, principal: Principal, ride_id: int, new_driver_id: int, reason: str
    ) -> None:
        self._require(
            principal, "ride.reassign", f"ride:{ride_id}", "dispatcher", "ops_admin"
        )
        ride = self._session.get(Ride, ride_id, with_for_update=True)
        driver = self._session.get(Driver, new_driver_id)
        if ride is None or driver is None:
            raise LookupError("ride or driver not found")
        if ride.status not in ("assigned", "en_route") or driver.status != "active":
            raise ValueError("ride cannot be reassigned to this driver")

        previous = ride.driver_id
        ride.driver_id = new_driver_id
        self._session.commit()
        self._audit.record(
            self._session,
            principal,
            "ride.reassigned",
            f"ride:{ride.id}",
            {"from_driver": previous, "to_driver": new_driver_id, "reason": reason},
        )
        self._session.commit()

    def set_surge_cap(
        self, principal: Principal, zone_id: int, cap: float, reason: str
    ) -> None:
        self._require(principal, "surge.set_cap", f"zone:{zone_id}", "ops_admin")
        if not 1.0 <= cap <= MAX_SURGE_CAP:
            raise ValueError("cap out of range")

        zone = self._session.get(SurgeZone, zone_id, with_for_update=True)
        if zone is None:
            raise LookupError(f"zone {zone_id} not found")

        previous = float(zone.cap_multiplier)
        zone.cap_multiplier = cap
        self._audit.record(
            self._session,
            principal,
            "surge.cap_changed",
            f"zone:{zone.id}",
            {"from": previous, "to": cap, "reason": reason},
        )
        self._session.commit()

    def _require(
        self, principal: Principal, action: str, target: str, *roles: str
    ) -> None:
        if principal.role in roles:
            return
        self._audit.record(
            self._session, principal, "access.denied", target, {"attempted": action}
        )
        self._session.commit()
        raise PermissionDenied(action)
