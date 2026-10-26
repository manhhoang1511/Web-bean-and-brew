"""Tạo dữ liệu mẫu.  Chạy:  python seed.py          (bỏ qua nếu đã có dữ liệu)
                              python seed.py --reset  (xóa sạch và tạo lại)"""
import json
import random
import sys
from datetime import datetime, timedelta

from app.database import Base, SessionLocal, engine
from app.models import Category, Coupon, Order, OrderItem, Product, ProductVariant, Review, Topping, User
from app.schemas import GRIND_OPTIONS, ICE_OPTIONS, SUGAR_OPTIONS
from app.security import hash_password
from app.services import build_search_text, recalc_rating, resolve_line_options
from app.utils import slugify

IMG = "https://images.unsplash.com/photo-{}?w=800&q=80&auto=format&fit=crop"

CATEGORIES = [
    ("Cà phê hạt", "Hạt rang xay tươi mỗi tuần", "🫘"),
    ("Cà phê bột", "Xay sẵn, tiện pha phin & máy", "☕"),
    ("Cà phê pha sẵn", "Cold brew, hòa tan, drip bag", "🧊"),
    ("Trà & Matcha", "Trà xanh, matcha, trà thảo mộc", "🍵"),
    ("Dụng cụ pha chế", "Phin, French press, máy xay", "⚙️"),
    ("Bánh & Đồ ăn kèm", "Bánh ngọt dùng kèm cà phê", "🥐"),
    ("Đồ uống pha chế", "Pha tại quán – chọn size, đá, đường, topping", "🥤"),
]

# Đồ uống pha chế: (tên, giá size S, ảnh, cho topping, nổi bật, mô tả). Size M +6k, L +12k
DRINKS = [
    ("Cà Phê Sữa Đá", 29000, "1578314675249-a6910f80cc4e", True, True,
     "Robusta Buôn Ma Thuột pha phin truyền thống, hòa quyện sữa đặc – đậm, béo, thơm đúng chất Sài Gòn."),
    ("Bạc Xỉu", 32000, "1592663527359-cf6642f54cff", True, True,
     "Nhiều sữa, ít cà phê: ngọt dịu, béo mịn, hợp với người mới uống cà phê."),
    ("Cappuccino", 45000, "1534778101976-62847782c213", True, False,
     "Espresso Blend House cùng sữa đánh bọt mịn, phủ bột cacao. Ngon nhất khi uống nóng."),
    ("Caffè Latte", 45000, "1541167760496-1628856ab772", True, False,
     "Espresso và nhiều sữa tươi, vị êm, nhẹ nhàng. Thêm sốt caramel để thành Caramel Latte."),
    ("Matcha Latte", 49000, "1536256263959-770b48d82b0a", True, True,
     "Matcha Uji Nhật Bản đánh tay cùng sữa tươi – thanh, chát nhẹ, hậu ngọt."),
    ("Trà Sữa Trân Châu Đường Đen", 42000, "1558857563-b371033873b8", True, True,
     "Trà đen đậm vị, sữa tươi và trân châu đường đen dẻo thơm nấu mỗi sáng."),
    ("Trà Đào Cam Sả", 39000, "1563227812-0ea4c22e6cc8", True, False,
     "Trà ô long ủ lạnh với đào miếng, cam vàng và sả tươi – thanh mát, giải nhiệt."),
    ("Mocha Đá Xay", 52000, "1627998792088-f8016b438988", True, False,
     "Espresso, socola Bỉ và đá xay mịn, phủ kem tươi – món tráng miệng dạng uống."),
    ("Soda Chanh Bạc Hà", 35000, "1556881286-fc6915169721", False, False,
     "Soda chanh tươi và lá bạc hà, chua nhẹ, sảng khoái – không caffeine."),
]
TOPPINGS = [("Trân châu đen", 8000), ("Thạch cà phê", 8000), ("Kem cheese", 12000),
            ("Shot espresso", 10000), ("Pudding trứng", 10000), ("Sốt caramel", 6000)]

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

    ("Matcha Uji Nhật Bản", 3, 260000, None, 22, "1515823064-d6e0c04616a7", [],
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

# ---- 30 sản phẩm bổ sung (ảnh CC0 lưu tại backend/static/products) ----
# 10 cà phê hạt + 20 sản phẩm chia cho 6 danh mục còn lại (4 + 4 + 3 + 3 + 3 + 3)
LOCAL = "/static/products/{}.jpg"

MORE_PRODUCTS = [
    # Cà phê hạt (10)
    ("Arabica Sơn La Natural", 0, 210000, None, 45, LOCAL.format("arabica-son-la"), [],
     "Thuận Châu, Sơn La", "Rang vừa (Medium)", "500g", False,
     "Sơ chế tự nhiên (natural) phơi nguyên trái. Hương trái cây chín, vị ngọt mật ong, chua dịu – rất hợp pha phin lẫn pour-over."),
    ("Robusta Gia Lai Honey", 0, 175000, 195000, 50, LOCAL.format("robusta-gia-lai-honey"), [],
     "Chư Sê, Gia Lai", "Rang vừa-đậm", "500g", True,
     "Robusta sơ chế honey hiếm gặp: đắng dịu, hậu ngọt đường nâu, ít chua. Pha cà phê sữa đá béo thơm khó cưỡng."),
    ("Moka Cầu Đất Thượng Hạng", 0, 290000, None, 16, LOCAL.format("moka-cau-dat"), [],
     "Cầu Đất, Đà Lạt", "Rang vừa (Medium)", "250g", True,
     "Giống Moka (Bourbon) quý hiếm của Đà Lạt. Hương thơm nồng nàn, chua thanh, hậu vị socola – niềm tự hào cà phê Việt."),
    ("Typica Lâm Đồng", 0, 230000, None, 22, LOCAL.format("typica-lam-dong"), [],
     "Lạc Dương, Lâm Đồng", "Rang sáng (Light)", "250g", False,
     "Giống Typica cổ, thân nhẹ, hương hoa trắng và vị trà đen. Pha V60 để cảm nhận rõ độ tinh tế."),
    ("Catimor Khe Sanh", 0, 155000, None, 70, LOCAL.format("catimor-khe-sanh"), [],
     "Khe Sanh, Quảng Trị", "Rang đậm (Dark)", "500g", False,
     "Arabica Catimor vùng Khe Sanh: vị đậm, đắng mạnh, thoảng mùi khói gỗ. Giá mềm, rất hợp pha phin hằng ngày."),
    ("Kenya AA Nyeri", 0, 360000, None, 12, LOCAL.format("kenya-aa"), [],
     "Nyeri, Kenya", "Rang sáng (Light)", "250g", False,
     "Hạt AA to đều nhất Kenya. Chua sáng vị lý chua đen và bưởi, hậu ngọt rõ, body mọng nước."),
    ("Brazil Santos", 0, 240000, None, 30, LOCAL.format("brazil-santos"), [],
     "Minas Gerais, Brazil", "Rang vừa (Medium)", "500g", False,
     "Thân dày, hương hạt dẻ và socola sữa, độ chua thấp – nền tảng của nhiều blend espresso nổi tiếng."),
    ("Guatemala Antigua", 0, 310000, None, 3, LOCAL.format("guatemala-antigua"), [],
     "Antigua, Guatemala", "Rang vừa (Medium)", "250g", False,
     "Trồng trên đất núi lửa: vị cacao, gia vị ấm và chua nhẹ kiểu táo đỏ. Cân bằng, dễ uống."),
    ("Sumatra Mandheling", 0, 330000, None, 18, LOCAL.format("sumatra-mandheling"), [],
     "Sumatra, Indonesia", "Rang đậm (Dark)", "250g", False,
     "Sơ chế bóc vỏ ướt đặc trưng Indonesia: body dày, vị đất, thảo mộc và socola đen, chua rất thấp."),
    ("Cà Phê Chồn Đặc Biệt", 0, 590000, 690000, 8, LOCAL.format("ca-phe-chon"), [],
     "Buôn Ma Thuột, Đắk Lắk", "Rang vừa (Medium)", "250g", True,
     "Hạt lên men tự nhiên theo phương pháp mô phỏng, vị êm mượt, đắng nhẹ, hậu ngọt kéo dài. Món quà biếu sang trọng."),

    # Cà phê bột (4)
    ("Bột Phin Rang Bơ", 1, 105000, 120000, 60, LOCAL.format("bot-phin-rang-bo"), [],
     "Đắk Lắk", "Rang đậm (Dark)", "500g", False,
     "Rang cùng bơ theo kiểu truyền thống Sài Gòn xưa: thơm béo, đậm đà, nước cốt sánh – pha sữa đá tuyệt vời."),
    ("Bột Espresso Blend 70/30", 1, 140000, None, 40, LOCAL.format("bot-espresso-blend"), [],
     "Arabica 70% + Robusta 30%", "Rang vừa-đậm", "250g", False,
     "Xay mịn chuẩn máy espresso: crema dày màu hạt dẻ, vị socola đắng, hậu ngọt caramel."),
    ("Bột Arabica Pour-over", 1, 150000, None, 25, LOCAL.format("bot-arabica-pour-over"), [],
     "Cầu Đất, Lâm Đồng", "Rang sáng (Light)", "250g", False,
     "Xay vừa (medium-fine) dành cho V60, Chemex, Kalita. Chua thanh, hương hoa, kết thúc sạch."),
    ("Bột Cà Phê Hộp Thiếc", 1, 165000, None, 20, LOCAL.format("bot-hop-thiec"), [],
     "Lâm Đồng", "Rang vừa (Medium)", "250g", False,
     "Đóng hộp thiếc kín khí, có van một chiều giữ hương lâu đến 6 tháng. Thiết kế đẹp, hợp làm quà tặng."),

    # Cà phê pha sẵn (4)
    ("Cà Phê Hòa Tan Đen Nguyên Chất", 2, 89000, None, 90, LOCAL.format("hoa-tan-den"), [],
     "Sấy lạnh (freeze-dried)", None, "Hũ 100g", False,
     "Cà phê hòa tan sấy lạnh giữ trọn hương vị, 0 đường 0 sữa. Chỉ cần nước nóng hoặc lạnh là có ly đen chuẩn vị."),
    ("Cold Brew Robusta Chai 250ml", 2, 39000, None, 40, LOCAL.format("cold-brew-robusta"), [],
     "Ủ lạnh 20 giờ", None, "Chai 250ml", False,
     "Robusta ủ lạnh 20 giờ: đậm, mượt, gần như không đắng gắt. Lắc đều, rót với đá hoặc pha thêm sữa."),
    ("Cà Phê Đen Đá Pha Sẵn", 2, 25000, None, 0, LOCAL.format("den-da-pha-san"), [],
     "Pha phin mỗi sáng", None, "Ly 350ml", False,
     "Đen đá pha phin từ Robusta Buôn Ma Thuột, giao trong ngày. Tỉnh táo tức thì cho buổi sáng bận rộn."),
    ("Latte Yến Mạch Đóng Ly", 2, 45000, None, 25, LOCAL.format("latte-yen-mach"), [],
     "Espresso + sữa yến mạch", None, "Ly 350ml", False,
     "Espresso Blend House cùng sữa yến mạch thuần chay – béo nhẹ, thơm ngũ cốc, không lactose."),

    # Trà & Matcha (3)
    ("Matcha Culinary Làm Bánh", 3, 150000, None, 30, LOCAL.format("matcha-culinary"), [],
     "Kagoshima, Nhật Bản", None, "100g", False,
     "Matcha culinary grade màu xanh tươi, vị đậm – dùng làm bánh, kem, latte với chi phí hợp lý."),
    ("Trà Lài Ngọc Trai", 3, 180000, None, 20, LOCAL.format("tra-lai-ngoc-trai"), [],
     "Phúc Kiến", None, "100g", False,
     "Búp trà xanh vo tròn như ngọc trai, ướp hoa nhài tươi nhiều lần. Pha ra nước vàng trong, hương nhài thanh khiết."),
    ("Trà Xanh Thái Nguyên", 3, 120000, None, 45, LOCAL.format("tra-xanh-thai-nguyen"), [],
     "Tân Cương, Thái Nguyên", None, "200g", False,
     "Đệ nhất danh trà Việt: cánh nhỏ, nước xanh, vị chát dịu và hậu ngọt sâu. Pha với nước 80°C."),

    # Dụng cụ pha chế (3)
    ("Ấm Moka Pot 6 Cup", 4, 420000, 490000, 14, LOCAL.format("am-moka-pot"), [],
     "Nhôm đúc nguyên khối", None, "300ml (6 cup)", False,
     "Pha cà phê đậm như espresso ngay trên bếp ga/bếp điện. Van an toàn, tay cầm cách nhiệt."),
    ("Máy Xay Điện Cổ Điển", 4, 690000, None, 6, LOCAL.format("may-xay-co-dien"), [],
     "Lưỡi dao inox", None, "Cối 80g", False,
     "Thiết kế vintage, xay nhanh 20 giây cho 1 mẻ. Phù hợp xay phin và French press."),
    ("Máy Pha Espresso Gia Đình", 4, 2490000, 2890000, 5, LOCAL.format("may-pha-espresso"), [],
     "Áp suất 15 bar", None, "Bình nước 1.2L", True,
     "Pha espresso, cappuccino, latte tại nhà: áp suất 15 bar, vòi đánh sữa, làm nóng trong 30 giây."),

    # Bánh & đồ ăn kèm (3)
    ("Cheesecake Nướng Basque", 5, 69000, None, 15, LOCAL.format("cheesecake-pistachio"), [],
     "Phô mai kem Pháp", None, "1 phần", False,
     "Mặt bánh cháy caramel, ruột phô mai mềm tan như kem. Ăn kèm Americano là chuẩn bài."),
    ("Muffin Socola Chip", 5, 39000, None, 28, LOCAL.format("muffin-socola"), [],
     "Socola Bỉ", None, "1 cái", False,
     "Bánh nướng mỗi sáng, xốp mềm, đầy socola chip tan chảy. Hâm nóng 10 giây cho thơm hơn."),
    ("Brownie Socola Cam", 5, 45000, None, 2, LOCAL.format("brownie-socola-cam"), [],
     "Cacao 70% & vỏ cam", None, "1 miếng", False,
     "Brownie đặc dẻo cacao 70%, điểm vỏ cam thơm mát – cân bằng vị đắng của espresso."),
]

MORE_DRINKS = [
    ("Socola Nóng Kem Tươi", 45000, LOCAL.format("socola-nong"), True, False,
     "Socola Bỉ nấu chảy cùng sữa tươi, phủ kem tươi và bột cacao – ấm áp cho ngày mưa."),
    ("Sinh Tố Kiwi", 49000, LOCAL.format("sinh-to-kiwi"), False, False,
     "Kiwi tươi xay cùng sữa chua và mật ong – chua ngọt, giàu vitamin C, không caffeine."),
    ("Sinh Tố Dâu Sữa Chua", 49000, LOCAL.format("sinh-to-dau"), False, False,
     "Dâu tây Đà Lạt xay cùng sữa chua Hy Lạp, béo mịn, chua ngọt dịu."),
]

PRODUCTS += MORE_PRODUCTS
DRINKS += MORE_DRINKS


def pic(x: str) -> str:
    """Ảnh local (/static/...) giữ nguyên, còn lại là id ảnh Unsplash."""
    return x if x.startswith("/") else IMG.format(x)


# Hệ số giá theo khối lượng, tính từ khối lượng gốc trong PRODUCTS
WEIGHT_FACTORS = {
    "250g": {"250g": 1, "500g": 1.8, "1kg": 3.4},
    "500g": {"250g": 0.55, "500g": 1, "1kg": 1.85},
}
STOCK_SPLIT = {"250g": 0.3, "500g": 0.5, "1kg": 0.2}


def make_variants(base_weight: str, price: int, orig: int | None, stock: int) -> list[ProductVariant]:
    r = lambda x: int(round(x / 1000) * 1000)  # noqa: E731
    return [
        ProductVariant(label=w, price=r(price * f), original_price=r(orig * f) if orig else None,
                       stock=round(stock * STOCK_SPLIT[w]), sort_order=i)
        for i, (w, f) in enumerate(WEIGHT_FACTORS[base_weight].items())
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
                        stock=stock, image_url=pic(img), images="\n".join(pic(x) for x in extra),
                        origin=origin, roast_level=roast, weight=weight, is_featured=feat, description=desc,
                        has_grind_option=ci == 0, created_at=datetime.now() - timedelta(days=60 - i * 2))
            if ci in (0, 1) and weight in WEIGHT_FACTORS:
                p.variants = make_variants(weight, price, orig, stock)
                p.weight = "250g / 500g / 1kg"
                p.sync_from_variants()
            p.search_text = build_search_text(p)
            products.append(p)
        for j, (name, price, img, tops, feat, desc) in enumerate(DRINKS):
            p = Product(name=name, slug=slugify(name), category=cats[6], image_url=pic(img), images="",
                        price=price, stock=0, weight="Size S / M / L", is_featured=feat, description=desc,
                        is_drink=True, allow_toppings=tops, created_at=datetime.now() - timedelta(days=5, hours=j),
                        variants=[ProductVariant(label=sz, price=price + extra, stock=60, sort_order=k)
                                  for k, (sz, extra) in enumerate([("S", 0), ("M", 6000), ("L", 12000)])])
            p.sync_from_variants()
            p.search_text = build_search_text(p)
            products.append(p)
        db.add_all(products)
        toppings = [Topping(name=n, price=pr, sort_order=k) for k, (n, pr) in enumerate(TOPPINGS)]
        db.add_all(toppings)

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
        for n in range(110):
            user = random.choice(customers)
            age_days = random.randint(0, 29)
            created = now - timedelta(days=age_days, hours=random.randint(0, 12), minutes=random.randint(0, 59))
            if age_days > 4:
                status = random.choices(["completed", "cancelled"], [9, 1])[0]
            else:
                status = random.choice(["pending", "shipping", "completed"])
            picks = random.sample(products, random.randint(1, 3))
            items = []
            for p in picks:
                v = random.choice(p.variants) if p.variants else None
                grind = random.choice(GRIND_OPTIONS) if p.has_grind_option else None
                sugar = random.choice(SUGAR_OPTIONS) if p.is_drink else None
                ice = random.choice(ICE_OPTIONS) if p.is_drink else None
                tops = [(t.id, random.randint(1, 2)) for t in random.sample(toppings, random.randint(0, 2))]                     if p.allow_toppings else []
                opts = resolve_line_options(p, v, grind, sugar, ice, tops, {t.id: t for t in toppings})
                items.append(OrderItem(product_id=p.id, variant_id=v.id if v else None, product_name=p.name,
                                       variant_label=opts.label, product_image=p.image_url,
                                       options_json=json.dumps(opts.options, ensure_ascii=False) if opts.options else None,
                                       unit_price=(v.price if v else p.price) + opts.extra_price,
                                       quantity=random.randint(1, 3)))
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
        print(f"✔ Đã tạo {len(products)} sản phẩm, {len(cats)} danh mục, {len(toppings)} topping, {len(customers)} khách hàng, 110 đơn hàng.")
        print("  Admin: admin@beanbrew.vn / admin123   |   Khách: user@beanbrew.vn / user123")
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
