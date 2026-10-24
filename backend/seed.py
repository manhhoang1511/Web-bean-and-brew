"""Tạo dữ liệu mẫu.  Chạy:  python seed.py          (bỏ qua nếu đã có dữ liệu)
                              python seed.py --reset  (xóa sạch và tạo lại)"""
import random
import sys
from datetime import datetime, timedelta

from app.database import Base, SessionLocal, engine
from app.models import Category, Coupon, Order, OrderItem, Product, Review, User
from app.security import hash_password
from app.services import build_search_text, recalc_rating
from app.utils import slugify

IMG = "https://images.unsplash.com/photo-{}?w=800&q=80&auto=format&fit=crop"

CATEGORIES = [
    ("Cà phê hạt", "Hạt rang xay tươi mỗi tuần", "🫘"),
    ("Cà phê bột", "Xay sẵn, tiện pha phin & máy", "☕"),
    ("Cà phê pha sẵn", "Cold brew, hòa tan, drip bag", "🧊"),
    ("Trà & Matcha", "Trà xanh, matcha, trà thảo mộc", "🍵"),
    ("Dụng cụ pha chế", "Phin, French press, máy xay", "⚙️"),
    ("Bánh & Đồ ăn kèm", "Bánh ngọt dùng kèm cà phê", "🥐"),
]

# (tên, danh mục, giá, giá gốc, tồn kho, ảnh, ảnh phụ, xuất xứ, mức rang, khối lượng, nổi bật, mô tả)
PRODUCTS = [
    ("Arabica Cầu Đất Honey", 0, 245000, 280000, 40, "1447933601403-0c6688de566e", ["1559056199-641a0ac8b55e"],
     "Cầu Đất, Đà Lạt", "Rang vừa (Medium)", "500g", True,
     "Arabica sơ chế Honey từ độ cao 1.650m. Hương mật ong, caramel, hậu vị chua thanh trái cây chín. Phù hợp pha pour-over, espresso."),
    ("Robusta Buôn Ma Thuột Đậm Vị", 0, 165000, None, 60, "1580933073521-dc49ac0d4e6a", ["1611854779393-1b2da9d400fe"],
     "Buôn Ma Thuột, Đắk Lắk", "Rang đậm (Dark)", "500g", True,
     "Robusta Fine chọn lọc, vị đắng đậm, body dày, ít chua, hậu vị socola đắng. Lý tưởng cho cà phê phin, cà phê sữa đá."),
    ("Ethiopia Yirgacheffe", 0, 320000, None, 18, "1606791405792-1004f1718d0c", ["1447933601403-0c6688de566e"],
     "Yirgacheffe, Ethiopia", "Rang sáng (Light)", "250g", True,
     "Specialty nhập khẩu. Hương hoa nhài, cam bergamot, vị chua sáng như trà. Dành cho người mê cà phê chua thanh, pha V60."),
    ("Colombia Supremo", 0, 290000, 310000, 25, "1587734195503-904fca47e0e9", [],
     "Huila, Colombia", "Rang vừa (Medium)", "250g", False,
     "Cân bằng giữa chua và ngọt, hương hạt dẻ, caramel, trái cây đỏ. Dễ uống, hợp mọi phương pháp pha."),
    ("Culi Robusta Sơn La", 0, 185000, None, 35, "1559056199-641a0ac8b55e", [],
     "Sơn La", "Rang đậm (Dark)", "500g", False,
     "Hạt culi tròn, rang đều, vị đậm mạnh, caffeine cao, hậu ngọt. Dành cho người cần tỉnh táo cả ngày."),
    ("Blend Espresso House", 0, 210000, None, 4, "1442550528053-c431ecb55509", [],
     "Arabica 70% + Robusta 30%", "Rang vừa-đậm", "500g", True,
     "Blend chuyên espresso: crema dày, vị socola, hạnh nhân rang, hậu vị ngọt dài. Pha latte, cappuccino rất ngon."),

    ("Bột Phin Truyền Thống", 1, 95000, 110000, 80, "1497935586351-b67a49e012bf", [],
     "Đắk Lắk", "Rang đậm (Dark)", "500g", True,
     "Cà phê bột xay sẵn cho phin, pha cà phê sữa đá chuẩn vị Sài Gòn. Đậm, thơm, sánh."),
    ("Bột Arabica Moka", 1, 135000, None, 45, "1495474472287-4d71bcdd2085", [],
     "Lâm Đồng", "Rang vừa (Medium)", "250g", False,
     "Arabica Moka xay mịn vừa, hương thơm quyến rũ, vị chua nhẹ, hậu ngọt. Pha phin hoặc French press."),
    ("Bột Espresso Xay Mịn", 1, 150000, None, 0, "1510591509098-f4fdc6d0ff04", [],
     "Arabica & Robusta", "Rang vừa-đậm", "250g", False,
     "Xay mịn chuẩn cho máy espresso gia đình. Crema đẹp, vị cân bằng."),

    ("Cold Brew Chai 330ml", 2, 45000, None, 50, "1461023058943-07fcbe16d735", ["1517487881594-2787fef5ebf7"],
     "Ủ lạnh 18 giờ", None, "330ml", True,
     "Cold brew ủ lạnh 18 giờ từ Arabica Cầu Đất. Mượt, ít đắng, ít chua. Uống liền hoặc pha với sữa tươi."),
    ("Cà Phê Sữa Hòa Tan 3in1", 2, 75000, 85000, 120, "1572442388796-11668a67e53d", [],
     "Việt Nam", None, "Hộp 20 gói", False,
     "Cà phê sữa hòa tan đậm đà, tiện lợi cho dân văn phòng. Chỉ cần nước nóng hoặc đá."),
    ("Drip Bag Arabica (Hộp 10)", 2, 120000, None, 30, "1504630083234-14187a9df0f5", [],
     "Cầu Đất", "Rang vừa (Medium)", "10 túi x 12g", False,
     "Túi lọc treo tiện lợi, pha pour-over chỉ trong 3 phút. Mang theo du lịch, văn phòng."),
    ("Latte Đá Đóng Chai", 2, 39000, None, 3, "1517701604599-bb29b565090c", [],
     "Espresso + sữa tươi", None, "300ml", False,
     "Latte pha sẵn từ espresso blend và sữa tươi thanh trùng. Bảo quản lạnh, dùng trong 5 ngày."),

    ("Matcha Uji Nhật Bản", 3, 260000, None, 22, "1515823064-d6e0c04616a7", ["1536256263959-770b48d82b0a"],
     "Uji, Kyoto", None, "100g", True,
     "Matcha ceremonial grade, màu xanh ngọc, vị umami, chát nhẹ, hậu ngọt. Pha matcha latte hoặc truyền thống."),
    ("Trà Ô Long Lâm Đồng", 3, 140000, None, 28, "1563822249366-3efb23b8e0c9", ["1544787219-7f47ccb76574"],
     "Bảo Lộc", None, "200g", False,
     "Ô long cuộn viên, hương hoa lan, nước vàng sáng, vị ngọt hậu. Pha nóng hoặc ủ lạnh."),
    ("Trà Thảo Mộc An Thần", 3, 89000, None, 40, "1556679343-c7306c1976bc", [],
     "Hoa cúc, oải hương, cam thảo", None, "20 túi lọc", False,
     "Không caffeine, giúp thư giãn, dễ ngủ. Thích hợp uống buổi tối."),

    ("Bộ 3 Ly Espresso Thủy Tinh", 4, 120000, None, 100, "1525480122447-64809d765ec4", [],
     "Thủy tinh chịu nhiệt", None, "3 ly x 90ml", False,
     "Bộ 3 ly thủy tinh dày hai lớp, giữ nhiệt lâu, ngắm trọn lớp crema. Hợp cho espresso, cà phê phin, cortado."),
    ("Bình Pha Chemex 600ml", 4, 280000, 350000, 15, "1504627298434-2119d6928e93", [],
     "Thủy tinh borosilicate", None, "600ml", True,
     "Bình pha thủ công kiểu Chemex, giấy lọc dày cho ly cà phê trong, sạch vị, làm nổi bật hương trái cây của Arabica."),
    ("Máy Xay Cà Phê Điện", 4, 450000, None, 10, "1611854779393-1b2da9d400fe", [],
     "Lưỡi xay Burr (cối nón)", None, "Dung tích 250g", False,
     "Máy xay cối nón 30 mức chỉnh độ mịn, từ espresso đến French press. Xay đều, ít nóng hạt, giữ trọn hương thơm."),
    ("Bộ Pour-over V60", 4, 390000, None, 2, "1545665225-b23b99e4d45e", [],
     "Phễu sứ + bình + 40 giấy lọc", None, "Size 02", False,
     "Bộ dụng cụ pha thủ công V60 cho người mới bắt đầu, làm nổi bật hương vị Arabica."),

    ("Croissant Bơ Pháp", 5, 32000, None, 30, "1555507036-ab1f4038808a", [],
     "Bơ Pháp", None, "1 cái", False,
     "Vỏ giòn nhiều lớp, ruột mềm thơm bơ. Kết hợp hoàn hảo với cappuccino buổi sáng."),
    ("Cookies Socola Chip", 5, 55000, None, 45, "1558961363-fa8fdf82db35", [],
     "Socola Bỉ", None, "Hộp 6 cái", False,
     "Bánh quy giòn rụm, đầy socola chip. Ăn kèm cà phê đen rất hợp."),
    ("Tiramisu Cà Phê", 5, 65000, None, 12, "1571877227200-a0d98ea607e9", [],
     "Mascarpone & espresso", None, "1 phần", True,
     "Tiramisu truyền thống thấm espresso Blend House, kem mascarpone béo nhẹ, phủ cacao."),
    ("Mousse Dâu Tây", 5, 59000, None, 0, "1488477181946-6428a0291777", [],
     "Dâu tây Đà Lạt", None, "1 hũ", False,
     "Mousse dâu tây chua ngọt mát lạnh trong hũ thủy tinh, cân bằng vị đậm của cà phê."),
]

REVIEW_TEXTS = [
    (5, "Rất thơm, đúng chuẩn mô tả. Sẽ ủng hộ tiếp!"),
    (5, "Giao hàng nhanh, đóng gói cẩn thận, chất lượng tuyệt vời."),
    (4, "Ngon, giá hơi cao một chút nhưng xứng đáng."),
    (5, "Pha phin buổi sáng tỉnh cả người 😄"),
    (4, "Hương vị ổn, sẽ thử thêm loại khác."),
    (3, "Tạm được, mình thích vị đậm hơn."),
    (5, "Đóng gói đẹp, mua làm quà rất hợp."),
]

CUSTOMERS = [
    ("Nguyễn Văn An", "an.nguyen@gmail.com"), ("Trần Thị Bình", "binh.tran@gmail.com"),
    ("Lê Hoàng Cường", "cuong.le@gmail.com"), ("Phạm Thu Dung", "dung.pham@gmail.com"),
    ("Hoàng Minh Đức", "duc.hoang@gmail.com"), ("Vũ Ngọc Hà", "ha.vu@gmail.com"),
    ("Đặng Quốc Huy", "huy.dang@gmail.com"), ("Bùi Lan Hương", "huong.bui@gmail.com"),
]
ADDRESSES = ["12 Nguyễn Huệ, Q.1, TP.HCM", "45 Trần Duy Hưng, Cầu Giấy, Hà Nội",
             "88 Lê Lợi, Hải Châu, Đà Nẵng", "21 Phan Đình Phùng, Đà Lạt"]


def seed(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Product).count():
            print("Đã có dữ liệu - bỏ qua. Dùng --reset để tạo lại.")
            return
        random.seed(42)

        admin = User(email="admin@beanbrew.vn", full_name="Quản trị viên", role="admin",
                     hashed_password=hash_password("admin123"))
        demo = User(email="user@beanbrew.vn", full_name="Khách Demo", phone="0901234567",
                    address="123 Lê Lợi, Q.1, TP.HCM", hashed_password=hash_password("user123"))
        customers = [demo] + [
            User(email=e, full_name=n, phone=f"09{random.randint(10000000, 99999999)}",
                 address=random.choice(ADDRESSES), hashed_password=hash_password("123456"))
            for n, e in CUSTOMERS
        ]
        db.add_all([admin, *customers])

        cats = [Category(name=n, slug=slugify(n), description=d, icon=i) for n, d, i in CATEGORIES]
        db.add_all(cats)
        db.flush()

        products = []
        for i, (name, ci, price, orig, stock, img, extra, origin, roast, weight, feat, desc) in enumerate(PRODUCTS):
            p = Product(name=name, slug=slugify(name), category=cats[ci], price=price, original_price=orig,
                        stock=stock, image_url=IMG.format(img), images="\n".join(IMG.format(x) for x in extra),
                        origin=origin, roast_level=roast, weight=weight, is_featured=feat, description=desc,
                        created_at=datetime.now() - timedelta(days=60 - i * 2))
            p.search_text = build_search_text(p)
            products.append(p)
        db.add_all(products)

        db.add_all([
            Coupon(code="WELCOME10", description="Giảm 10% cho đơn đầu tiên (tối đa 50.000đ)",
                   discount_percent=10, max_discount=50000, min_order=0),
            Coupon(code="BEAN20", description="Giảm 20% cho đơn từ 500.000đ (tối đa 150.000đ)",
                   discount_percent=20, max_discount=150000, min_order=500000),
            Coupon(code="SUMMER15", description="Giảm 15% mùa hè (đã hết hạn)",
                   discount_percent=15, max_discount=100000, min_order=200000, is_active=False),
        ])
        db.flush()

        # Đơn hàng lịch sử 30 ngày gần nhất để dashboard có dữ liệu
        now = datetime.now()
        purchased: set[tuple[int, int]] = set()
        for n in range(70):
            user = random.choice(customers)
            age_days = random.randint(0, 29)
            created = now - timedelta(days=age_days, hours=random.randint(0, 12), minutes=random.randint(0, 59))
            if age_days > 4:
                status = random.choices(["completed", "cancelled"], [9, 1])[0]
            else:
                status = random.choice(["pending", "shipping", "completed"])
            picks = random.sample(products, random.randint(1, 3))
            items = [OrderItem(product_id=p.id, product_name=p.name, product_image=p.image_url,
                               unit_price=p.price, quantity=random.randint(1, 3)) for p in picks]
            subtotal = sum(i.unit_price * i.quantity for i in items)
            ship = 0 if subtotal >= 500000 else 30000
            method = random.choice(["cod", "card", "qr"])
            paid = "paid" if method != "cod" or status == "completed" else "unpaid"
            if status == "cancelled" and paid == "paid":
                paid = "refunded"
            db.add(Order(code=f"BB{created:%y%m%d}{n:04d}", user_id=user.id, status=status,
                         payment_method=method, payment_status=paid, shipping_name=user.full_name,
                         shipping_phone=user.phone or "0900000000", shipping_address=user.address or ADDRESSES[0],
                         subtotal=subtotal, shipping_fee=ship, total=subtotal + ship,
                         created_at=created, updated_at=created, items=items))
            if status != "cancelled":
                for it, p in zip(items, picks):
                    p.sold_count += it.quantity
                    if status == "completed":
                        purchased.add((user.id, p.id))

        for user_id, product_id in purchased:
            if random.random() < 0.6:
                rating, text = random.choice(REVIEW_TEXTS)
                db.add(Review(user_id=user_id, product_id=product_id, rating=rating, comment=text,
                              created_at=now - timedelta(days=random.randint(0, 20))))
        db.flush()
        for p in products:
            recalc_rating(db, p)

        db.commit()
        print(f"✔ Đã tạo {len(products)} sản phẩm, {len(cats)} danh mục, {len(customers)} khách hàng, 70 đơn hàng.")
        print("  Admin: admin@beanbrew.vn / admin123   |   Khách: user@beanbrew.vn / user123")
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
