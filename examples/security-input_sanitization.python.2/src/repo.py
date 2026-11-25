import sqlite3
from pathlib import Path

from sanitize import like_contains, resolve_inside, safe_image_name
from schemas import RestaurantQuery

MAX_IMAGE_BYTES = 2 * 1024 * 1024

ORDER_BY = {
    "rating": "rating DESC, name",
    "eta": "eta_minutes, name",
    "name": "name",
}


def search_restaurants(conn: sqlite3.Connection, query: RestaurantQuery) -> list[sqlite3.Row]:
    sql = "SELECT id, name, cuisine, rating, eta_minutes FROM restaurants WHERE 1 = 1"
    params: list[object] = []
    if query.q:
        sql += " AND name LIKE ? ESCAPE '\\'"
        params.append(like_contains(query.q))
    if query.cuisine:
        sql += " AND cuisine = ?"
        params.append(query.cuisine)
    sql += f" ORDER BY {ORDER_BY[query.sort]} LIMIT ?"
    params.append(query.limit)
    return conn.execute(sql, params).fetchall()


def add_delivery_note(conn: sqlite3.Connection, order_id: int, note: str) -> None:
    conn.execute("INSERT INTO delivery_notes (order_id, note) VALUES (?, ?)", (order_id, note))
    conn.commit()


def list_delivery_notes(conn: sqlite3.Connection, order_id: int) -> list[str]:
    rows = conn.execute(
        "SELECT note FROM delivery_notes WHERE order_id = ? ORDER BY id", (order_id,)
    ).fetchall()
    return [row["note"] for row in rows]


def store_menu_image(root: Path, original_name: str, data: bytes) -> Path:
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("image too large")
    target = resolve_inside(root, safe_image_name(original_name))
    target.write_bytes(data)
    return target
