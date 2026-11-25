from .principal import Principal


def can_view_payslip(principal: Principal, employee_id: str) -> bool:
    if principal.employee_id == employee_id:
        return True
    if principal.is_hr:
        return True
    return principal.manages(employee_id)


def can_publish_payslips(principal: Principal) -> bool:
    return principal.is_hr()
