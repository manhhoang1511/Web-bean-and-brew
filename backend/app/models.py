"""Các bảng CSDL (ORM models)."""
import json
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="customer")  # customer | admin
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    orders: Mapped[list["Order"]] = relationship(back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255))
    icon: Mapped[str | None] = mapped_column(String(10))

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[int] = mapped_column(Integer)  # VND
    original_price: Mapped[int | None] = mapped_column(Integer)  # giá gốc để hiển thị giảm giá
    stock: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[str] = mapped_column(String(500), default="")
    images: Mapped[str] = mapped_column(Text, default="")  # danh sách URL, phân tách bằng dấu xuống dòng
    origin: Mapped[str | None] = mapped_column(String(100))  # xuất xứ
    roast_level: Mapped[str | None] = mapped_column(String(50))  # mức rang
    weight: Mapped[str | None] = mapped_column(String(50))
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # ẩn/hiện trên cửa hàng
    sold_count: Mapped[int] = mapped_column(Integer, default=0)
    rating_avg: Mapped[float] = mapped_column(Float, default=0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    # Văn bản không dấu để tìm kiếm "ca phe" vẫn ra "Cà phê"
    search_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Cho phép chọn kiểu xay (nguyên hạt / phin / espresso...) – không đổi giá
    has_grind_option: Mapped[bool] = mapped_column(Boolean, default=False)
    # Đồ uống pha chế: chọn mức đá + mức đường; allow_toppings: được thêm topping (tính thêm tiền)
    is_drink: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_toppings: Mapped[bool] = mapped_column(Boolean, default=False)

    category: Mapped[Category | None] = relationship(back_populates="products")
    reviews: Mapped[list["Review"]] = relationship(back_populates="product", cascade="all, delete-orphan")
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductVariant.sort_order",
        lazy="selectin",
    )

    @property
    def in_stock(self) -> bool:
        return self.stock > 0

    def sync_from_variants(self) -> None:
        """Sản phẩm có biến thể: giá hiển thị = giá thấp nhất, tồn kho = tổng các biến thể."""
        if self.variants:
            cheapest = min(self.variants, key=lambda v: v.price)
            self.price, self.original_price = cheapest.price, cheapest.original_price
            self.stock = sum(v.stock for v in self.variants)

    @property
    def gallery(self) -> list[str]:
        extra = [u for u in self.images.split("\n") if u.strip()] if self.images else []
        return [self.image_url, *extra] if self.image_url else extra


class ProductVariant(Base):
    """Biến thể: VD khối lượng 250g / 500g / 1kg, mỗi loại một giá và tồn kho riêng."""
    __tablename__ = "product_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(60))
    price: Mapped[int] = mapped_column(Integer)
    original_price: Mapped[int | None] = mapped_column(Integer)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="variants")


class Topping(Base):
    """Topping thêm cho đồ uống (trân châu, kem cheese, shot espresso...)."""
    __tablename__ = "toppings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    price: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Wishlist(Base):
    __tablename__ = "wishlists"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    product: Mapped[Product] = relationship()


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_review_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    product: Mapped[Product] = relationship(back_populates="reviews")
    user: Mapped[User] = relationship()


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    discount_percent: Mapped[int] = mapped_column(Integer)
    max_discount: Mapped[int | None] = mapped_column(Integer)
    min_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # pending (Đang xử lý) -> shipping (Đang giao) -> completed (Đã hoàn thành) | cancelled
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    payment_method: Mapped[str] = mapped_column(String(20))  # cod | card | qr
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")  # unpaid | paid | refunded
    shipping_name: Mapped[str] = mapped_column(String(120))
    shipping_phone: Mapped[str] = mapped_column(String(20))
    shipping_address: Mapped[str] = mapped_column(String(255))
    note: Mapped[str | None] = mapped_column(String(500))
    subtotal: Mapped[int] = mapped_column(Integer)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    shipping_fee: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    coupon_code: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("product_variants.id", ondelete="SET NULL"))
    # Lưu snapshot tên/giá tại thời điểm mua để lịch sử đơn không đổi khi sản phẩm bị sửa/xóa
    product_name: Mapped[str] = mapped_column(String(200))
    variant_label: Mapped[str | None] = mapped_column(String(255))  # VD "M · Ít đá · 50% đường · +1 Trân châu"
    # Snapshot tùy chọn dạng JSON: {"grind", "sugar", "ice", "toppings": [{"id","name","price","quantity"}]}
    options_json: Mapped[str | None] = mapped_column(Text)
    product_image: Mapped[str] = mapped_column(String(500), default="")
    unit_price: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)

    order: Mapped[Order] = relationship(back_populates="items")

    @property
    def line_total(self) -> int:
        return self.unit_price * self.quantity

    @property
    def options(self) -> dict | None:
        return json.loads(self.options_json) if self.options_json else None
