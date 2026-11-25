from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Employee:
    employee_id: str
    name: str
    department: str
    manager_id: Optional[str] = None


class Directory:
    def __init__(self, employees):
        self._by_id = {e.employee_id: e for e in employees}

    def get(self, employee_id: str) -> Optional[Employee]:
        return self._by_id.get(employee_id)

    def chain_of_command(self, employee_id: str) -> list:
        """Ids of everyone above the employee, nearest manager first."""
        chain = []
        seen = {employee_id}
        current = self._by_id.get(employee_id)
        while current is not None and current.manager_id is not None:
            if current.manager_id in seen:
                break
            chain.append(current.manager_id)
            seen.add(current.manager_id)
            current = self._by_id.get(current.manager_id)
        return chain
