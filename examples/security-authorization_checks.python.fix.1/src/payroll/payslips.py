from .audit import AuditLog
from .directory import Directory
from .policy import can_publish_payslips, can_view_payslip
from .principal import Principal


class NotFound(Exception):
    pass


class PermissionDenied(Exception):
    pass


class PayslipService:
    def __init__(self, directory: Directory, payslips: dict):
        self._directory = directory
        self._payslips = payslips
        self.audit = AuditLog()

    def get(self, principal: Principal, employee_id: str) -> dict:
        if self._directory.get(employee_id) is None or employee_id not in self._payslips:
            raise NotFound(employee_id)
        allowed = can_view_payslip(principal, employee_id)
        self.audit.record(principal.employee_id, "view", employee_id, allowed)
        if not allowed:
            raise PermissionDenied(f"{principal.employee_id} may not view {employee_id}")
        return self._payslips[employee_id]

    def visible_to(self, principal: Principal) -> list:
        return sorted(e for e in self._payslips if can_view_payslip(principal, e))

    def publish(self, principal: Principal, employee_id: str, payslip: dict) -> None:
        if not can_publish_payslips(principal):
            raise PermissionDenied("only HR may publish payslips")
        self._payslips[employee_id] = payslip
