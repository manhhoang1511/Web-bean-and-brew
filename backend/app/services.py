"""Logic nghiệp vụ dùng chung giữa các router."""
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .models import Category, Coupon, Product, Review
from .schemas import ProductIn
from .utils import slugify, strip_accents


def build_search_text(p: Product) -> str:
    parts = [p.name, p.description, p.origin or "", p.roast_level or ""]
    if p.category:
        parts.append(p.category.name)
    return strip_accents(" ".join(parts))


def unique_slug(db: Session, model, base: str, exclude_id: int | None = None) -> str:
    slug, i = base or "item", 2
    while True:
        q = select(model.id).where(model.slug == slug)
        if exclude_id:
            q = q.where(model.id != exclude_id)
        if not db.scalar(q):
            return slug
        slug, i = f"{base}-{i}", i + 1


def apply_product_data(db: Session, product: Product, data: ProductIn) -> Product:
    if data.category_id is not None and not db.get(Category, data.category_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Danh mục không tồn tại")
    payload = data.model_dump()
    payload["images"] = "\n".join(u.strip() for u in payload.pop("images") if u.strip())
    for field, value in payload.items():
        setattr(product, field, value)
    product.slug = unique_slug(db, Product, slugify(data.name), product.id)
    db.flush()
    db.refresh(product)
    product.search_text = build_search_text(product)
    return product


def recalc_rating(db: Session, product: Product) -> None:
    avg, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.product_id == product.id)
    ).one()
    product.rating_avg = round(float(avg or 0), 1)
    product.rating_count = count


def calc_coupon_discount(db: Session, code: str | None, subtotal: int) -> tuple[Coupon | None, int]:
    """Trả về (coupon, số tiền giảm). Ném lỗi 400 nếu mã không hợp lệ."""
    if not code:
        return None, 0
    coupon = db.scalar(select(Coupon).where(func.upper(Coupon.code) == code.strip().upper()))
    if not coupon or not coupon.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mã giảm giá không hợp lệ")
    if subtotal < coupon.min_order:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Đơn hàng tối thiểu {coupon.min_order:,}đ để dùng mã này".replace(",", "."),
        )
    discount = subtotal * coupon.discount_percent // 100
    if coupon.max_discount:
        discount = min(discount, coupon.max_discount)
    return coupon, discount


def calc_shipping(subtotal_after_discount: int) -> int:
    return 0 if subtotal_after_discount >= settings.FREE_SHIPPING_THRESHOLD else settings.SHIPPING_FEE
