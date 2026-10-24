import random
import string
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Order, OrderItem, Product, User
from ..schemas import CouponCheckIn, CouponCheckOut, OrderCreate, OrderOut
from ..security import get_current_user
from ..services import calc_coupon_discount, calc_shipping

router = APIRouter(prefix="/api", tags=["Orders"])

DECLINED_TEST_CARD = "4000000000000002"  # thẻ test luôn bị từ chối


def _luhn_ok(number: str) -> bool:
    digits = [int(d) for d in number][::-1]
    total = sum(d if i % 2 == 0 else (d * 2 - 9 if d * 2 > 9 else d * 2) for i, d in enumerate(digits))
    return total % 10 == 0


def _process_mock_payment(method: str, card_number: str | None) -> str:
    """Thanh toán giả lập. Trả về payment_status."""
    if method in ("cod", "qr"):
        return "unpaid"  # COD: thu khi giao; QR: chờ khách xác nhận chuyển khoản
    number = (card_number or "").replace(" ", "").replace("-", "")
    if not (number.isdigit() and 13 <= len(number) <= 19 and _luhn_ok(number)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Số thẻ không hợp lệ")
    if number == DECLINED_TEST_CARD:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Giao dịch bị ngân hàng từ chối (thẻ test)")
    return "paid"


def _new_order_code(db: Session) -> str:
    while True:
        code = "BB" + datetime.now().strftime("%y%m%d") + "".join(random.choices(string.digits, k=4))
        if not db.scalar(select(Order.id).where(Order.code == code)):
            return code


def restore_stock(db: Session, order: Order) -> None:
    """Hoàn kho khi đơn bị hủy."""
    for item in order.items:
        if item.product_id and (p := db.get(Product, item.product_id)):
            p.stock += item.quantity
            p.sold_count = max(0, p.sold_count - item.quantity)
    if order.payment_status == "paid":
        order.payment_status = "refunded"


@router.post("/coupons/check", response_model=CouponCheckOut)
def check_coupon(data: CouponCheckIn, db: Session = Depends(get_db)):
    coupon, discount = calc_coupon_discount(db, data.code, data.subtotal)
    return CouponCheckOut(code=coupon.code, description=coupon.description, discount=discount)


@router.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(data: OrderCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Gộp các dòng trùng sản phẩm
    quantities: dict[int, int] = {}
    for item in data.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    # Khóa các dòng sản phẩm (có tác dụng trên MySQL/Postgres) để tránh bán vượt tồn kho
    products = {
        p.id: p
        for p in db.scalars(select(Product).where(Product.id.in_(quantities)).with_for_update()).all()
    }

    # Giá luôn lấy từ CSDL, không tin giá client gửi lên
    subtotal = 0
    order_items = []
    for pid, qty in quantities.items():
        p = products.get(pid)
        if not p or not p.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Sản phẩm #{pid} không còn bán")
        if p.stock < qty:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{p.name}' chỉ còn {p.stock} sản phẩm")
        subtotal += p.price * qty
        order_items.append(OrderItem(product_id=p.id, product_name=p.name, product_image=p.image_url,
                                     unit_price=p.price, quantity=qty))

    coupon, discount = calc_coupon_discount(db, data.coupon_code, subtotal)
    shipping_fee = calc_shipping(subtotal - discount)
    payment_status = _process_mock_payment(data.payment_method, data.card_number)

    for pid, qty in quantities.items():
        products[pid].stock -= qty
        products[pid].sold_count += qty

    order = Order(
        code=_new_order_code(db),
        user_id=user.id,
        status="pending",
        payment_method=data.payment_method,
        payment_status=payment_status,
        shipping_name=data.shipping_name,
        shipping_phone=data.shipping_phone,
        shipping_address=data.shipping_address,
        note=data.note,
        subtotal=subtotal,
        discount=discount,
        shipping_fee=shipping_fee,
        total=subtotal - discount + shipping_fee,
        coupon_code=coupon.code if coupon else None,
        items=order_items,
    )
    db.add(order)

    # Lưu địa chỉ để lần sau tự điền
    if not user.address:
        user.address = data.shipping_address
    if not user.phone:
        user.phone = data.shipping_phone

    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=list[OrderOut])
def my_orders(
    status_filter: str | None = Query(None, alias="status"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Order).options(selectinload(Order.items)).where(Order.user_id == user.id)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    return db.scalars(stmt.order_by(Order.created_at.desc(), Order.id.desc())).all()


def _my_order(db: Session, user: User, code: str) -> Order:
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.code == code))
    if not order or (order.user_id != user.id and user.role != "admin"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy đơn hàng")
    return order


@router.get("/orders/{code}", response_model=OrderOut)
def get_order(code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _my_order(db, user, code)


@router.post("/orders/{code}/pay", response_model=OrderOut)
def confirm_qr_payment(code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Giả lập webhook ngân hàng báo đã nhận chuyển khoản QR."""
    order = _my_order(db, user, code)
    if order.payment_method != "qr" or order.payment_status != "unpaid" or order.status == "cancelled":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Đơn hàng không ở trạng thái chờ thanh toán")
    order.payment_status = "paid"
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{code}/cancel", response_model=OrderOut)
def cancel_order(code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = _my_order(db, user, code)
    if order.status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Chỉ có thể hủy đơn đang xử lý")
    order.status = "cancelled"
    restore_stock(db, order)
    db.commit()
    db.refresh(order)
    return order
