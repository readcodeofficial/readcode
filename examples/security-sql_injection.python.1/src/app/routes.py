from flask import Blueprint, g, jsonify, request

from .db import get_connection
from .users_repo import UserQuery, find_by_email, revoke_sessions, search_users

bp = Blueprint("admin_users", __name__, url_prefix="/admin/users")


def _int_arg(name, default):
    try:
        return int(request.args.get(name, default))
    except ValueError:
        return default


@bp.get("")
def list_users():
    query = UserQuery(
        text=request.args.get("q", "").strip()[:100],
        roles=tuple(request.args.getlist("role")),
        sort=request.args.get("sort", "created_at"),
        direction=request.args.get("dir", "DESC"),
        limit=_int_arg("limit", 25),
        offset=_int_arg("offset", 0),
    )
    with get_connection() as conn:
        rows = search_users(conn, g.auth.tenant_id, query)
    return jsonify(users=rows)


@bp.get("/lookup")
def lookup_user():
    email = request.args.get("email", "").strip()
    if not email:
        return jsonify(error="email is required"), 400
    with get_connection() as conn:
        user = find_by_email(conn, g.auth.tenant_id, email)
    if user is None:
        return jsonify(error="not found"), 404
    return jsonify(user=user)


@bp.post("/revoke-sessions")
def revoke():
    payload = request.get_json(silent=True) or {}
    user_ids = [i for i in payload.get("user_ids", []) if isinstance(i, int)]
    with get_connection() as conn:
        revoked = revoke_sessions(conn, g.auth.tenant_id, user_ids)
        conn.commit()
    return jsonify(revoked=revoked)
