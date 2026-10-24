from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Category, Order, OrderItem, Product, Review, User
from ..schemas import CategoryOut, CategoryWithCount, Page, ProductOut, ReviewIn, ReviewOut
from ..security import get_current_user
from ..services import recalc_rating
from ..utils import page_count, strip_accents

router = APIRouter(prefix="/api", tags=["Catalog"])

SortOption = Literal["newest", "price_asc", "price_desc", "rating", "bestseller"]
SORTS = {
    "newest": Product.created_at.desc(),
    "price_asc": Product.price.asc(),
    "price_desc": Product.price.desc(),
    "rating": Product.rating_avg.desc(),
    "bestseller": Product.sold_count.desc(),
}


@router.get("/categories", response_model=list[CategoryWithCount])
def list_categories(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Category, func.count(Product.id))
        .outerjoin(Product, (Product.category_id == Category.id) & Product.is_active)
        .group_by(Category.id)
        .order_by(Category.id)
    ).all()
    return [CategoryWithCount(**CategoryOut.model_validate(c).model_dump(), product_count=n) for c, n in rows]


@router.get("/products", response_model=Page[ProductOut])
def list_products(
    q: str | None = Query(None, description="Từ khóa tìm kiếm (không phân biệt dấu)"),
    category: str | None = Query(None, description="Slug danh mục"),
    min_price: int | None = Query(None, ge=0),
    max_price: int | None = Query(None, ge=0),
    in_stock: bool = False,
    featured: bool = False,
    sort: SortOption = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=60),
    db: Session = Depends(get_db),
):
    stmt = select(Product).where(Product.is_active.is_(True))
    if q:
        for word in strip_accents(q).split():
            stmt = stmt.where(Product.search_text.contains(word))
    if category:
        stmt = stmt.join(Category).where(Category.slug == category)
    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)
    if in_stock:
        stmt = stmt.where(Product.stock > 0)
    if featured:
        stmt = stmt.where(Product.is_featured.is_(True))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(
        stmt.options(joinedload(Product.category))
        .order_by(SORTS[sort], Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page(items=items, total=total, page=page, page_size=page_size, pages=page_count(total, page_size))


@router.get("/products/price-range")
def price_range(db: Session = Depends(get_db)):
    lo, hi = db.execute(select(func.min(Product.price), func.max(Product.price)).where(Product.is_active)).one()
    return {"min": lo or 0, "max": hi or 0}


@router.get("/products/suggest", response_model=list[ProductOut])
def suggest(q: str = Query(min_length=1), db: Session = Depends(get_db)):
    """Gợi ý nhanh khi gõ ô tìm kiếm."""
    stmt = select(Product).where(Product.is_active.is_(True))
    for word in strip_accents(q).split():
        stmt = stmt.where(Product.search_text.contains(word))
    return db.scalars(stmt.order_by(Product.sold_count.desc()).limit(6)).all()


def _get_product(db: Session, key: str) -> Product:
    cond = Product.id == int(key) if key.isdigit() else Product.slug == key
    product = db.scalar(select(Product).options(joinedload(Product.category)).where(cond))
    if not product or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy sản phẩm")
    return product


@router.get("/products/{key}", response_model=ProductOut)
def get_product(key: str, db: Session = Depends(get_db)):
    """Lấy chi tiết theo id hoặc slug."""
    return _get_product(db, key)


@router.get("/products/{key}/related", response_model=list[ProductOut])
def related_products(key: str, db: Session = Depends(get_db)):
    product = _get_product(db, key)
    return db.scalars(
        select(Product)
        .where(Product.is_active, Product.id != product.id, Product.category_id == product.category_id)
        .order_by(Product.sold_count.desc())
        .limit(4)
    ).all()


def _purchased_user_ids(db: Session, product_id: int) -> set[int]:
    return set(
        db.scalars(
            select(Order.user_id)
            .join(OrderItem)
            .where(OrderItem.product_id == product_id, Order.status == "completed")
        ).all()
    )


@router.get("/products/{key}/reviews", response_model=list[ReviewOut])
def list_reviews(key: str, db: Session = Depends(get_db)):
    product = _get_product(db, key)
    buyers = _purchased_user_ids(db, product.id)
    reviews = db.scalars(
        select(Review).options(joinedload(Review.user))
        .where(Review.product_id == product.id)
        .order_by(Review.created_at.desc())
    ).all()
    return [ReviewOut(**ReviewOut.model_validate(r).model_dump(exclude={"verified_purchase"}),
                      verified_purchase=r.user_id in buyers) for r in reviews]


@router.get("/products/{key}/review-eligibility")
def review_eligibility(key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product = _get_product(db, key)
    return {"can_review": user.id in _purchased_user_ids(db, product.id)}


@router.post("/products/{key}/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(key: str, data: ReviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Chỉ khách đã nhận hàng thành công mới được đánh giá (chống đánh giá ảo).
    Mỗi người 1 đánh giá / sản phẩm; gửi lại sẽ cập nhật đánh giá cũ."""
    product = _get_product(db, key)
    if user.id not in _purchased_user_ids(db, product.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn cần mua và nhận hàng thành công để đánh giá sản phẩm này")
    review = db.scalar(select(Review).where(Review.user_id == user.id, Review.product_id == product.id))
    if review:
        review.rating, review.comment = data.rating, data.comment
    else:
        review = Review(product_id=product.id, user_id=user.id, rating=data.rating, comment=data.comment)
        db.add(review)
    db.flush()
    recalc_rating(db, product)
    db.commit()
    db.refresh(review)
    return ReviewOut(**ReviewOut.model_validate(review).model_dump(exclude={"verified_purchase"}), verified_purchase=True)
