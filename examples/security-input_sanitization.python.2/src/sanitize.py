import unicodedata
import uuid
from pathlib import Path, PurePosixPath

ALLOWED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def clean_text(value: str, *, max_len: int, allow_newlines: bool = False) -> str:
    text = unicodedata.normalize("NFKC", value)
    kept = []
    for ch in text:
        if ch == "\n" and allow_newlines:
            kept.append(ch)
        elif unicodedata.category(ch) in ("Cc", "Cf", "Cs"):
            continue
        else:
            kept.append(ch)
    cleaned = "".join(kept).strip()
    if len(cleaned) > max_len:
        raise ValueError(f"text longer than {max_len} characters")
    return cleaned


def like_contains(term: str) -> str:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def safe_image_name(filename: str) -> str:
    base = PurePosixPath(filename.replace("\\", "/")).name
    suffix = Path(base).suffix.lower()
    if suffix not in ALLOWED_IMAGE_SUFFIXES:
        raise ValueError("unsupported image type")
    return f"{uuid.uuid4().hex}{suffix}"


def resolve_inside(root: Path, name: str) -> Path:
    base = root.resolve()
    target = (base / name).resolve()
    if not target.is_relative_to(base):
        raise ValueError("path escapes the upload directory")
    return target


def csv_cell(value: str) -> str:
    if value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value
