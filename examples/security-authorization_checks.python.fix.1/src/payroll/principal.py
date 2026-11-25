from .directory import Directory


class Principal:
    """The authenticated caller, as seen by the payroll service."""

    def __init__(self, employee_id: str, roles: frozenset, directory: Directory):
        self.employee_id = employee_id
        self.roles = roles
        self._directory = directory

    def is_hr(self) -> bool:
        return "hr" in self.roles

    def manages(self, employee_id: str) -> bool:
        return self.employee_id in self._directory.chain_of_command(employee_id)
