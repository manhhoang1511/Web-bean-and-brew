"""Logic nghiệp vụ dùng chung giữa các router."""
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .config import settings
from .models import Category, Coupon, OrderItem, Product, ProductVariant, Review, Topping
from .schemas import (
    DEFAULT_ICE, DEFAULT_SUGAR, GRIND_OPTIONS, ICE_OPTIONS, MAX_TOPPING_QTY, MAX_TOPPINGS_TOTAL, SUGAR_OPTIONS,
    ProductIn,
)
from .utils import slugify, strip_accents


def build_search_text(p: Product) -> str:
    parts = [p.name, p.description, p.origin or "", p.roast_level or "", p.weight or ""]
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
    payload = data.model_dump(exclude={"variants"})
    payload["images"] = "\n".join(u.strip() for u in payload.pop("images") if u.strip())
    for field, value in payload.items():
        setattr(product, field, value)
    product.slug = unique_slug(db, Product, slugify(data.name), product.id)
    db.flush()
    _save_variants(db, product, data)
    db.flush()
    db.refresh(product)
    product.sync_from_variants()
    product.search_text = build_search_text(product)
    return product


def _save_variants(db: Session, product: Product, data: ProductIn) -> None:
    existing = {v.id: v for v in product.variants}
    keep: list[ProductVariant] = []
    for i, v in enumerate(data.variants):
        variant = existing.get(v.id) if v.id else None
        if variant is None:
            variant = ProductVariant(product_id=product.id)
            db.add(variant)
        variant.label, variant.price, variant.original_price, variant.stock = v.label, v.price, v.original_price, v.stock
        variant.sort_order = i
        keep.append(variant)
    removed = [vid for vid in existing if vid not in {v.id for v in keep}]
    if removed:
        # Đơn hàng cũ vẫn giữ snapshot variant_label
        db.execute(update(OrderItem).where(OrderItem.variant_id.in_(removed)).values(variant_id=None))
        for vid in removed:
            db.delete(existing[vid])
    db.flush()
    db.expire(product, ["variants"])


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


@dataclass
class LineOptions:
    """Kết quả kiểm tra tùy chọn của 1 dòng hàng."""
    extra_price: int          # tiền topping cộng thêm cho MỖI ly
    label: str | None         # VD "M · Ít đá · 50% đường · +2 Trân châu"
    options: dict | None      # snapshot lưu vào order_items.options_json


def resolve_line_options(product: Product, variant: ProductVariant | None, grind: str | None,
                         sugar: str | None, ice: str | None, toppings: list[tuple[int, int]],
                         toppings_by_id: dict[int, Topping]) -> LineOptions:
    """Kiểm tra kiểu xay / đá / đường / topping và tính tiền topping. Sai -> HTTP 400.
    toppings: [(topping_id, quantity)]"""
    def bad(msg: str):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{msg} ('{product.name}')")

    if grind and (not product.has_grind_option or grind not in GRIND_OPTIONS):
        bad("Kiểu xay không hợp lệ")
    if product.is_drink:
        sugar = sugar or DEFAULT_SUGAR
        ice = ice or DEFAULT_ICE
        if sugar not in SUGAR_OPTIONS or ice not in ICE_OPTIONS:
            bad("Mức đường / đá không hợp lệ")
    elif sugar or ice:
        bad("Sản phẩm này không chọn đường / đá")

    merged: dict[int, int] = {}
    for tid, qty in toppings:
        merged[tid] = merged.get(tid, 0) + qty
    if merged and not product.allow_toppings:
        bad("Sản phẩm này không thêm topping")
    chosen = []
    for tid, qty in merged.items():
        t = toppings_by_id.get(tid)
        if not t or not t.is_active:
            bad(f"Topping #{tid} không còn phục vụ")
        if qty > MAX_TOPPING_QTY:
            bad(f"Mỗi loại topping tối đa {MAX_TOPPING_QTY} phần")
        chosen.append({"id": t.id, "name": t.name, "price": t.price, "quantity": qty})
    if sum(c["quantity"] for c in chosen) > MAX_TOPPINGS_TOTAL:
        bad(f"Tối đa {MAX_TOPPINGS_TOTAL} phần topping mỗi ly")
    chosen.sort(key=lambda c: c["id"])

    parts = [variant.label if variant else None, grind, ice if product.is_drink else None,
             f"{sugar} đường" if product.is_drink else None,
             *[f"+{c['quantity']} {c['name']}" for c in chosen]]
    options = {k: v for k, v in {"grind": grind, "sugar": sugar if product.is_drink else None,
                                 "ice": ice if product.is_drink else None, "toppings": chosen or None}.items() if v}
    return LineOptions(extra_price=sum(c["price"] * c["quantity"] for c in chosen),
                       label=" · ".join(p for p in parts if p) or None, options=options or None)


def calc_shipping(subtotal_after_discount: int) -> int:
    return 0 if subtotal_after_discount >= settings.FREE_SHIPPING_THRESHOLD else settings.SHIPPING_FEE
