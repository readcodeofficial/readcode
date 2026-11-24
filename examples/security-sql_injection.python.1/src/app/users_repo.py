from dataclasses import dataclass

from psycopg import sql
from psycopg.rows import dict_row

SORTABLE_COLUMNS = {"email", "display_name", "created_at", "last_login_at"}
MAX_PAGE_SIZE = 100


@dataclass(frozen=True)
class UserQuery:
    text: str = ""
    roles: tuple = ()
    sort: str = "created_at"
    direction: str = "DESC"
    limit: int = 25
    offset: int = 0


def escape_like(value):
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_users(conn, tenant_id, query):
    clauses = [sql.SQL("tenant_id = %(tenant)s"), sql.SQL("deleted_at IS NULL")]
    params = {
        "tenant": tenant_id,
        "limit": min(max(query.limit, 1), MAX_PAGE_SIZE),
        "offset": max(query.offset, 0),
    }

    if query.text:
        clauses.append(sql.SQL("(email ILIKE %(pattern)s OR display_name ILIKE %(pattern)s)"))
        params["pattern"] = "%" + escape_like(query.text) + "%"
    if query.roles:
        clauses.append(sql.SQL("role = ANY(%(roles)s)"))
        params["roles"] = list(query.roles)

    sort = query.sort if query.sort in SORTABLE_COLUMNS else "created_at"
    direction = query.direction
    if not direction.upper().startswith(("ASC", "DESC")):
        direction = "DESC"

    statement = sql.SQL(
        "SELECT id, email, display_name, role, created_at, last_login_at "
        "FROM users WHERE {where} ORDER BY {column} {direction}, id "
        "LIMIT %(limit)s OFFSET %(offset)s"
    ).format(
        where=sql.SQL(" AND ").join(clauses),
        column=sql.Identifier(sort),
        direction=sql.SQL(direction),
    )

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(statement, params)
        return cur.fetchall()


def find_by_email(conn, tenant_id, email):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, email, role, mfa_enabled FROM users "
            "WHERE tenant_id = %s AND lower(email) = lower(%s) AND deleted_at IS NULL",
            (tenant_id, email),
        )
        return cur.fetchone()


def revoke_sessions(conn, tenant_id, user_ids):
    if not user_ids:
        return 0
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET revoked_at = now() "
            "WHERE tenant_id = %s AND user_id = ANY(%s) AND revoked_at IS NULL",
            (tenant_id, list(user_ids)),
        )
        return cur.rowcount
