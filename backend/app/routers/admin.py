import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from ..config import settings
from ..database import get_db
from ..models import Category, Coupon, Order, OrderItem, Product, User
from ..schemas import (
    AdminOrderOut, CategoryIn, CategoryOut, CouponOut, CustomerOut, Page, ProductIn, ProductOut,
    ProductPatch, RevenuePoint, StatsOut, TopProduct, OrderStatusUpdate,
)
from ..security import require_admin
from ..services import apply_product_data, build_search_text, unique_slug
from ..utils import page_count, slugify, strip_accents
from .orders import restore_stock

router = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(require_admin)])

# Luồng trạng thái hợp lệ của đơn hàng
ALLOWED_TRANSITIONS = {
    "pending": {"shipping", "cancelled"},
    "shipping": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}
REVENUE_STATUSES = ("pending", "shipping", "completed")  # đơn không bị hủy


# ---------------- Thống kê ----------------
@router.get("/stats", response_model=StatsOut)
def stats(days: int = Query(14, ge=7, le=90), db: Session = Depends(get_db)):
    valid = Order.status.in_(REVENUE_STATUSES)
    total_revenue = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(valid))
    valid_orders = db.scalar(select(func.count(Order.id)).where(valid))
    today = date.today()
    revenue_today, orders_today = db.execute(
        select(func.coalesce(func.sum(Order.total), 0), func.count(Order.id))
        .where(valid, func.date(Order.created_at) == today.isoformat())
    ).one()

    by_status = dict(db.execute(select(Order.status, func.count(Order.id)).group_by(Order.status)).all())

    start = today - timedelta(days=days - 1)
    day_col = func.date(Order.created_at)
    rows = db.execute(
        select(day_col, func.sum(Order.total), func.count(Order.id))
        .where(valid, day_col >= start.isoformat())
        .group_by(day_col)
    ).all()
    per_day = {str(d): (int(r), int(n)) for d, r, n in rows}
    revenue_by_day = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        r, n = per_day.get(d, (0, 0))
        revenue_by_day.append(RevenuePoint(date=d, revenue=r, orders=n))

    top_rows = db.execute(
        select(Product.id, Product.name, Product.image_url,
               func.sum(OrderItem.quantity), func.sum(OrderItem.quantity * OrderItem.unit_price))
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(valid)
        .group_by(Product.id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
    ).all()

    return StatsOut(
        total_revenue=total_revenue,
        total_orders=db.scalar(select(func.count(Order.id))),
        total_customers=db.scalar(select(func.count(User.id)).where(User.role == "customer")),
        total_products=db.scalar(select(func.count(Product.id))),
        revenue_today=revenue_today,
        orders_today=orders_today,
        average_order_value=total_revenue // valid_orders if valid_orders else 0,
        orders_by_status={s: by_status.get(s, 0) for s in ALLOWED_TRANSITIONS},
        revenue_by_day=revenue_by_day,
        top_products=[TopProduct(id=i, name=n, image_url=img, sold=s, revenue=r) for i, n, img, s, r in top_rows],
        low_stock=db.scalars(
            select(Product).options(joinedload(Product.category))
            .where(Product.stock <= 5).order_by(Product.stock).limit(6)
        ).all(),
        recent_orders=db.scalars(
            select(Order).options(selectinload(Order.items), joinedload(Order.user))
            .order_by(Order.created_at.desc(), Order.id.desc()).limit(6)
        ).all(),
    )


# ---------------- Sản phẩm ----------------
@router.get("/products", response_model=Page[ProductOut])
def admin_products(
    q: str | None = None,
    category_id: int | None = None,
    stock: str | None = Query(None, pattern="^(in|out|low)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(Product)
    if q:
        for word in strip_accents(q).split():
            stmt = stmt.where(Product.search_text.contains(word))
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if stock == "in":
        stmt = stmt.where(Product.stock > 0)
    elif stock == "out":
        stmt = stmt.where(Product.stock == 0)
    elif stock == "low":
        stmt = stmt.where(Product.stock.between(1, 5))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(
        stmt.options(joinedload(Product.category)).order_by(Product.id.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return Page(items=items, total=total, page=page, page_size=page_size, pages=page_count(total, page_size))


@router.get("/products/{product_id}", response_model=ProductOut)
def admin_get_product(product_id: int, db: Session = Depends(get_db)):
    return _product_or_404(db, product_id)


def _product_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy sản phẩm")
    return product


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    product = Product(name=data.name, slug="tmp-" + uuid.uuid4().hex, price=data.price)
    db.add(product)
    apply_product_data(db, product, data)
    db.commit()
    db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductIn, db: Session = Depends(get_db)):
    product = _product_or_404(db, product_id)
    apply_product_data(db, product, data)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
def patch_product(product_id: int, data: ProductPatch, db: Session = Depends(get_db)):
    """Cập nhật nhanh: tồn kho (còn/hết hàng), ẩn/hiện, nổi bật."""
    product = _product_or_404(db, product_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = _product_or_404(db, product_id)
    # Đơn hàng cũ vẫn giữ snapshot tên/giá, chỉ bỏ liên kết tới sản phẩm
    db.execute(update(OrderItem).where(OrderItem.product_id == product_id).values(product_id=None))
    db.delete(product)
    db.commit()


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Chỉ chấp nhận file ảnh")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ảnh tối đa 5MB")
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()[:5]
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    settings.UPLOAD_DIR.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    (settings.UPLOAD_DIR / name).write_bytes(content)
    return {"url": f"/uploads/{name}"}


# ---------------- Danh mục ----------------
@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    if db.scalar(select(Category).where(Category.name == data.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Tên danh mục đã tồn tại")
    cat = Category(**data.model_dump(), slug=unique_slug(db, Category, slugify(data.name)))
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, data: CategoryIn, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy danh mục")
    for field, value in data.model_dump().items():
        setattr(cat, field, value)
    cat.slug = unique_slug(db, Category, slugify(data.name), cat.id)
    for p in cat.products:
        p.search_text = build_search_text(p)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy danh mục")
    db.execute(update(Product).where(Product.category_id == category_id).values(category_id=None))
    db.delete(cat)
    db.commit()


# ---------------- Đơn hàng ----------------
@router.get("/orders", response_model=Page[AdminOrderOut])
def admin_orders(
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Mã đơn, tên, SĐT hoặc email"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(Order).join(User)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            Order.code.ilike(like) | Order.shipping_name.ilike(like)
            | Order.shipping_phone.ilike(like) | User.email.ilike(like)
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(
        stmt.options(selectinload(Order.items), joinedload(Order.user))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return Page(items=items, total=total, page=page, page_size=page_size, pages=page_count(total, page_size))


@router.patch("/orders/{order_id}/status", response_model=AdminOrderOut)
def update_order_status(order_id: int, data: OrderStatusUpdate, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy đơn hàng")
    if data.status not in ALLOWED_TRANSITIONS[order.status]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Không thể chuyển đơn từ '{order.status}' sang '{data.status}'")
    if data.status == "shipping" and order.payment_method != "cod" and order.payment_status != "paid":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Đơn trả trước chưa được thanh toán, chưa thể giao hàng")
    order.status = data.status
    if data.status == "cancelled":
        restore_stock(db, order)
    elif data.status == "completed" and order.payment_method == "cod":
        order.payment_status = "paid"  # thu tiền khi giao hàng thành công
    db.commit()
    db.refresh(order)
    return order


# ---------------- Khách hàng ----------------
@router.get("/customers", response_model=list[CustomerOut])
def customers(db: Session = Depends(get_db)):
    spent = (
        select(Order.user_id, func.count(Order.id).label("n"), func.sum(Order.total).label("s"))
        .where(Order.status.in_(REVENUE_STATUSES))
        .group_by(Order.user_id).subquery()
    )
    rows = db.execute(
        select(User, spent.c.n, spent.c.s).outerjoin(spent, spent.c.user_id == User.id)
        .where(User.role == "customer").order_by(User.created_at.desc())
    ).all()
    return [CustomerOut(**CustomerOut.model_validate(u).model_dump(exclude={"order_count", "total_spent"}),
                        order_count=n or 0, total_spent=s or 0) for u, n, s in rows]


# ---------------- Mã giảm giá ----------------
@router.get("/coupons", response_model=list[CouponOut])
def list_coupons(db: Session = Depends(get_db)):
    return db.scalars(select(Coupon).order_by(Coupon.id)).all()


@router.patch("/coupons/{coupon_id}/toggle", response_model=CouponOut)
def toggle_coupon(coupon_id: int, db: Session = Depends(get_db)):
    coupon = db.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy mã giảm giá")
    coupon.is_active = not coupon.is_active
    db.commit()
    db.refresh(coupon)
    return coupon
