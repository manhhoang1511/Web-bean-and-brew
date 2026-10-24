from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Product, User, Wishlist
from ..schemas import ProductOut
from ..security import get_current_user

router = APIRouter(prefix="/api/wishlist", tags=["Wishlist"])


@router.get("", response_model=list[ProductOut])
def my_wishlist(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Product).join(Wishlist, Wishlist.product_id == Product.id)
        .options(joinedload(Product.category))
        .where(Wishlist.user_id == user.id, Product.is_active.is_(True))
        .order_by(Wishlist.created_at.desc(), Wishlist.id.desc())
    ).unique().all()


@router.get("/ids", response_model=list[int])
def my_wishlist_ids(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Danh sách id để frontend tô trái tim nhanh, không cần tải cả sản phẩm."""
    return db.scalars(select(Wishlist.product_id).where(Wishlist.user_id == user.id)).all()


@router.post("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def add(product_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy sản phẩm")
    exists = db.scalar(select(Wishlist.id).where(Wishlist.user_id == user.id, Wishlist.product_id == product_id))
    if not exists:
        db.add(Wishlist(user_id=user.id, product_id=product_id))
        db.commit()


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(product_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(delete(Wishlist).where(Wishlist.user_id == user.id, Wishlist.product_id == product_id))
    db.commit()
