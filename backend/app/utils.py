import math
import re
import unicodedata


def slugify(text: str) -> str:
    """'Cà Phê Sữa Đá' -> 'ca-phe-sua-da'"""
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def strip_accents(text: str) -> str:
    return slugify(text).replace("-", " ")


def page_count(total: int, page_size: int) -> int:
    return max(1, math.ceil(total / page_size))


def format_vnd(amount: int) -> str:
    return f"{amount:,.0f}đ".replace(",", ".")
