# ☕ Bean & Brew – Website bán cà phê (Vibe Coding Project)

Hệ thống thương mại điện tử bán cà phê rang xay, trà và dụng cụ pha chế, gồm **phân hệ Khách hàng**, **phân hệ Quản trị** và **AI Chatbot tư vấn bán hàng**.

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind CSS 4, React Router 7, Zustand, Axios, Recharts |
| Backend | FastAPI (Python 3.11) + SQLAlchemy 2.0 + Pydantic 2 |
| Database | SQLite (mặc định) – đổi sang MySQL chỉ bằng `DATABASE_URL` |
| Xác thực | JWT (HS256) + bcrypt |
| AI | Google Gemini **hoặc** OpenAI (REST qua httpx) + chế độ offline dự phòng |
| Kiểm thử | pytest (10 test end-to-end cho API) |

---

## 🚀 Cài đặt & chạy

**Yêu cầu:** Python 3.10+, Node.js 18+.

### Cách nhanh (Windows)
```bat
setup.bat     :: cài thư viện + tạo dữ liệu mẫu (chạy 1 lần)
start.bat     :: mở backend + frontend + trình duyệt
```

### Cách thủ công
```bash
# 1. Backend  (http://localhost:8000, tài liệu API: http://localhost:8000/docs)
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env
python seed.py                    # tạo dữ liệu mẫu (--reset để tạo lại)
uvicorn app.main:app --reload --port 8000

# 2. Frontend (http://localhost:5173) – mở terminal khác
cd frontend
npm install
npm run dev
```

### Bật AI Chatbot thật
Điền `GEMINI_API_KEY` (miễn phí tại https://aistudio.google.com/apikey) hoặc `OPENAI_API_KEY` vào `backend/.env`, khởi động lại backend.
Không có key thì chatbot vẫn chạy ở **chế độ offline** (gợi ý theo từ khóa, ngân sách, khẩu vị).

### Tài khoản demo
| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin@beanbrew.vn` | `admin123` |
| Khách hàng | `user@beanbrew.vn` | `user123` |

Mã giảm giá: `WELCOME10` (−10%), `BEAN20` (−20% đơn từ 500k). Thẻ test: `4242 4242 4242 4242` (thành công), `4000 0000 0000 0002` (bị từ chối).

### Chạy test
```bash
cd backend && .venv\Scripts\python -m pytest -q
```

---

## ✅ Chức năng

### Khách hàng
- Đăng ký / đăng nhập bằng JWT, cập nhật hồ sơ, đổi mật khẩu
- Trang chủ: hero, danh mục, sản phẩm nổi bật, bán chạy
- Cửa hàng: **tìm kiếm không dấu** ("ca phe" → "Cà phê"), lọc danh mục, khoảng giá, còn hàng, sắp xếp 5 kiểu, phân trang; bộ lọc lưu trên URL (chia sẻ link được)
- Gợi ý tìm kiếm tức thì (debounce) ngay trên thanh header
- Chi tiết sản phẩm: gallery ảnh, thông số, tồn kho, đánh giá (sao + bình luận, huy hiệu "Đã mua hàng"), sản phẩm liên quan
- Giỏ hàng: thêm/sửa/xóa, lưu localStorage, tự đồng bộ giá & tồn kho mới nhất, thanh tiến độ freeship
- Thanh toán: mã giảm giá, 3 phương thức giả lập (COD / thẻ / QR)
- Đơn hàng của tôi: lọc theo trạng thái, timeline *Đang xử lý → Đang giao → Đã hoàn thành*, hủy đơn, mua lại

### Quản trị viên (`/admin`)
- Dashboard: doanh thu, số đơn, khách hàng, giá trị TB/đơn, biểu đồ doanh thu 7/14/30 ngày, tỉ lệ trạng thái đơn, top bán chạy, cảnh báo sắp hết hàng, đơn gần đây
- Sản phẩm (CRUD): thêm/sửa/xóa, **upload ảnh**, cập nhật nhanh tồn kho (còn/hết hàng), ẩn/hiện, nổi bật
- Đơn hàng: lọc, tìm kiếm, xem chi tiết, cập nhật trạng thái theo đúng luồng
- Danh mục (CRUD), Khách hàng (số đơn, tổng chi tiêu), Mã giảm giá (bật/tắt)

### Nâng cao – AI Chatbot (`POST /api/chat`)
- System prompt chứa vai trò "nhân viên tư vấn", quy tắc, chính sách, mã giảm giá và **toàn bộ danh sách sản phẩm hiện có** (giá, tồn kho, mô tả)
- Trả kèm **thẻ sản phẩm** được nhắc đến → khách bấm thêm vào giỏ ngay trong khung chat
- Fallback: Gemini → OpenAI → offline, nên demo không bao giờ "chết"

## ✨ Cải tiến so với đề bài
1. **Bảo mật giá**: server luôn tính lại giá từ CSDL, không tin giá client gửi
2. **Quản lý tồn kho thật**: trừ kho khi đặt, hoàn kho khi hủy, chặn bán vượt tồn kho
3. **Máy trạng thái đơn hàng**: chặn chuyển trạng thái sai (VD: không thể từ "Đang xử lý" nhảy thẳng "Hoàn thành")
4. **Snapshot đơn hàng**: lưu tên/giá/ảnh tại thời điểm mua, sửa/xóa sản phẩm không làm sai lịch sử
5. Mã giảm giá, phí ship & freeship, thanh toán thẻ giả lập có kiểm tra Luhn
6. Tìm kiếm tiếng Việt không dấu, gợi ý tức thì
7. Chatbot có chế độ offline + hiển thị thẻ sản phẩm
8. Bộ test tự động pytest, Swagger UI tự sinh tại `/docs`
9. Responsive mobile, skeleton loading, toast, ErrorBoundary, code-splitting trang admin

📖 Xem [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) để hiểu kiến trúc & luồng dữ liệu (chuẩn bị vấn đáp), [docs/VIBE_CODING.md](docs/VIBE_CODING.md) cho quy trình làm việc với AI Agent.

## 📁 Cấu trúc thư mục
```
backend/
  app/
    main.py          # khởi tạo FastAPI, CORS, đăng ký router
    config.py        # đọc cấu hình từ .env
    database.py      # engine, session, get_db
    models.py        # bảng CSDL (ORM)
    schemas.py       # Pydantic: validate input / định dạng output
    security.py      # bcrypt, JWT, phân quyền
    services.py      # logic dùng chung (coupon, shipping, slug, rating)
    routers/         # auth, products, orders, admin, chat
  seed.py            # dữ liệu mẫu
  tests/test_api.py  # kiểm thử API
frontend/src/
  api/               # axios client + kiểu dữ liệu TypeScript
  store/             # Zustand: auth, cart (lưu localStorage)
  components/        # Layout, ProductCard, ChatWidget, UI dùng chung
  pages/             # trang khách hàng
  pages/admin/       # trang quản trị
```
