import csv
import html
import io
import sqlite3
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, PlainTextResponse

from repo import (
    MAX_IMAGE_BYTES,
    add_delivery_note,
    list_delivery_notes,
    search_restaurants,
    store_menu_image,
)
from sanitize import csv_cell
from schemas import NoteBody, RestaurantQuery

app = FastAPI()
UPLOAD_ROOT = Path("/var/lib/deliveries/menu-images")


def get_conn():
    conn = sqlite3.connect("deliveries.db")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


@app.get("/restaurants")
def list_restaurants(query: RestaurantQuery = Depends(), conn=Depends(get_conn)):
    return [dict(row) for row in search_restaurants(conn, query)]


@app.post("/orders/{order_id}/notes", status_code=201)
def create_note(order_id: int, body: NoteBody, conn=Depends(get_conn)):
    add_delivery_note(conn, order_id, body.note)
    return {"order_id": order_id}


@app.get("/orders/{order_id}/slip", response_class=HTMLResponse)
def delivery_slip(order_id: int, conn=Depends(get_conn)):
    items = "".join(f"<li>{html.escape(n)}</li>" for n in list_delivery_notes(conn, order_id))
    return f"<h1>Order {order_id}</h1><ul>{items}</ul>"


@app.post("/restaurants/{restaurant_id}/menu-image", status_code=201)
async def upload_menu_image(restaurant_id: int, file: UploadFile):
    data = await file.read(MAX_IMAGE_BYTES + 1)
    try:
        saved = store_menu_image(UPLOAD_ROOT, file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"restaurant_id": restaurant_id, "file": saved.name}


@app.get("/admin/notes.csv", response_class=PlainTextResponse)
def export_notes(conn=Depends(get_conn)):
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["order_id", "note"])
    for row in conn.execute("SELECT order_id, note FROM delivery_notes ORDER BY id"):
        writer.writerow([row["order_id"], csv_cell(row["note"])])
    return out.getvalue()
