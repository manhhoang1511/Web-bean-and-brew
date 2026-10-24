"""Pydantic schemas: kiểm tra dữ liệu vào và định dạng dữ liệu ra của API."""
from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


# ---------- Auth / User ----------
class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=6, max_length=100)
    phone: str | None = Field(default=None, max_length=20)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    phone: str | None
    address: str | None
    role: str
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=100)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=100)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Category ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=10)


class CategoryOut(ORMModel):
    id: int
    name: str
    slug: str
    description: str | None
    icon: str | None


class CategoryWithCount(CategoryOut):
    product_count: int = 0


# ---------- Product ----------
GRIND_OPTIONS = ["Nguyên hạt", "Xay phin", "Xay pour-over", "Xay espresso", "Xay French press"]
# Tùy chọn đồ uống pha chế (phần tử đầu tiên KHÔNG phải mặc định – xem DEFAULT_*)
SUGAR_OPTIONS = ["0%", "30%", "50%", "70%", "100%"]
ICE_OPTIONS = ["Nóng", "Không đá", "Ít đá", "Vừa đá", "Nhiều đá"]
DEFAULT_SUGAR, DEFAULT_ICE = "100%", "Vừa đá"
MAX_TOPPING_QTY = 3      # tối đa mỗi loại topping
MAX_TOPPINGS_TOTAL = 5   # tối đa tổng số phần topping cho 1 ly


class ToppingIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    price: int = Field(ge=0)
    is_active: bool = True


class ToppingOut(ORMModel):
    id: int
    name: str
    price: int
    is_active: bool


class ToppingChoice(BaseModel):
    topping_id: int
    quantity: int = Field(ge=1, le=MAX_TOPPING_QTY)


class VariantIn(BaseModel):
    id: int | None = None  # có id = sửa biến thể cũ (giữ liên kết với đơn hàng cũ)
    label: str = Field(min_length=1, max_length=60)
    price: int = Field(gt=0)
    original_price: int | None = Field(default=None, gt=0)
    stock: int = Field(ge=0, default=0)


class VariantOut(ORMModel):
    id: int
    label: str
    price: int
    original_price: int | None
    stock: int


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str = ""
    price: int = Field(gt=0)
    original_price: int | None = Field(default=None, gt=0)
    stock: int = Field(ge=0, default=0)
    image_url: str = ""
    images: list[str] = []
    origin: str | None = None
    roast_level: str | None = None
    weight: str | None = None
    is_featured: bool = False
    is_active: bool = True
    category_id: int | None = None
    has_grind_option: bool = False
    is_drink: bool = False
    allow_toppings: bool = False
    variants: list[VariantIn] = Field(default=[], max_length=10)


class ProductPatch(BaseModel):
    """Cập nhật nhanh một vài trường (VD: tồn kho, ẩn/hiện, nổi bật)."""
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    is_featured: bool | None = None
    price: int | None = Field(default=None, gt=0)


class ProductOut(ORMModel):
    id: int
    name: str
    slug: str
    description: str
    price: int
    original_price: int | None
    stock: int
    in_stock: bool
    image_url: str
    gallery: list[str]
    origin: str | None
    roast_level: str | None
    weight: str | None
    is_featured: bool
    is_active: bool
    sold_count: int
    rating_avg: float
    rating_count: int
    category: CategoryOut | None
    has_grind_option: bool
    is_drink: bool
    allow_toppings: bool
    variants: list[VariantOut]
    created_at: datetime


# ---------- Review ----------
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class ReviewUser(ORMModel):
    id: int
    full_name: str


class ReviewOut(ORMModel):
    id: int
    rating: int
    comment: str
    created_at: datetime
    user: ReviewUser
    verified_purchase: bool = False


# ---------- Coupon ----------
class CouponCheckIn(BaseModel):
    code: str
    subtotal: int = Field(ge=0)


class CouponCheckOut(BaseModel):
    code: str
    description: str
    discount: int


class CouponOut(ORMModel):
    id: int
    code: str
    description: str
    discount_percent: int
    max_discount: int | None
    min_order: int
    is_active: bool


# ---------- Order ----------
OrderStatus = Literal["pending", "shipping", "completed", "cancelled"]
PaymentMethod = Literal["cod", "card", "qr"]


class CartItemIn(BaseModel):
    product_id: int
    variant_id: int | None = None
    grind: str | None = None
    sugar: str | None = None
    ice: str | None = None
    toppings: list[ToppingChoice] = Field(default=[], max_length=10)
    quantity: int = Field(ge=1, le=99)


class OrderCreate(BaseModel):
    items: list[CartItemIn] = Field(min_length=1)
    shipping_name: str = Field(min_length=2, max_length=120)
    shipping_phone: str = Field(pattern=r"^0\d{9,10}$")
    shipping_address: str = Field(min_length=5, max_length=255)
    note: str | None = Field(default=None, max_length=500)
    payment_method: PaymentMethod = "cod"
    coupon_code: str | None = None
    card_number: str | None = None  # chỉ dùng cho thanh toán thẻ giả lập


class OrderItemOut(ORMModel):
    id: int
    product_id: int | None
    variant_id: int | None
    product_name: str
    variant_label: str | None
    options: dict | None
    product_image: str
    unit_price: int
    quantity: int
    line_total: int


class OrderCustomer(ORMModel):
    id: int
    email: str
    full_name: str


class OrderOut(ORMModel):
    id: int
    code: str
    status: OrderStatus
    payment_method: PaymentMethod
    payment_status: str
    shipping_name: str
    shipping_phone: str
    shipping_address: str
    note: str | None
    subtotal: int
    discount: int
    shipping_fee: int
    total: int
    coupon_code: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut]


class AdminOrderOut(OrderOut):
    user: OrderCustomer


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ---------- Admin stats ----------
class RevenuePoint(BaseModel):
    date: str
    revenue: int
    orders: int


class TopProduct(BaseModel):
    id: int
    name: str
    image_url: str
    sold: int
    revenue: int


class StatsOut(BaseModel):
    total_revenue: int
    total_orders: int
    total_customers: int
    total_products: int
    revenue_today: int
    orders_today: int
    average_order_value: int
    orders_by_status: dict[str, int]
    revenue_by_day: list[RevenuePoint]
    top_products: list[TopProduct]
    low_stock: list[ProductOut]
    recent_orders: list[AdminOrderOut]


class CustomerOut(UserOut):
    order_count: int = 0
    total_spent: int = 0


# ---------- Chat ----------
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class ChatCartLine(BaseModel):
    """Giỏ hàng hiện tại phía client, gửi kèm để chatbot tư vấn theo ngữ cảnh."""
    product_id: int
    variant_label: str | None = None
    grind: str | None = None
    quantity: int = Field(ge=1, le=99)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    cart: list[ChatCartLine] = Field(default=[], max_length=50)


class ChatAction(BaseModel):
    """Hành động chatbot yêu cầu frontend thực hiện (đã được server kiểm tra hợp lệ)."""
    type: Literal["add_to_cart"] = "add_to_cart"
    product: ProductOut
    variant_id: int | None = None
    grind: str | None = None
    sugar: str | None = None
    ice: str | None = None
    toppings: list[ToppingChoice] = []
    quantity: int


class ChatOut(BaseModel):
    reply: str
    products: list[ProductOut] = []
    actions: list[ChatAction] = []
    provider: str
