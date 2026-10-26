# ☕ Bean & Brew – Website bán cà phê (Vibe Coding Project)

Hệ thống thương mại điện tử bán cà phê rang xay, trà và dụng cụ pha chế, gồm **phân hệ Khách hàng**, **phân hệ Quản trị** và **AI Chatbot tư vấn bán hàng** (Gemini, streaming, tự thêm vào giỏ bằng lời).

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind CSS 4, React Router 7, Zustand, Axios, Recharts |
| Backend | FastAPI (Python 3.11) + SQLAlchemy 2.0 + Pydantic 2 |
| Database | SQLite (mặc định) – đổi sang MySQL chỉ bằng `DATABASE_URL` |
| Xác thực | JWT (HS256) + bcrypt, đặt lại mật khẩu bằng token dùng 1 lần |
| AI | Google Gemini (mặc định `gemini-3.5-flash-lite`) **hoặc** OpenAI – streaming SSE + function calling, có chế độ offline |
| Realtime | Server-Sent Events: chat streaming, thông báo đơn mới cho admin |
| Kiểm thử | pytest – 22 test end-to-end cho API |
| Triển khai | Docker Compose (nginx + FastAPI) |

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

### Chạy bằng Docker (tùy chọn)
```bash
docker compose up --build        # mở http://localhost:8080
```

> ⚠️ Nếu cập nhật code từ phiên bản cũ (CSDL thay đổi cấu trúc), chạy `python seed.py --reset` để tạo lại dữ liệu.

### Bật AI Chatbot
Điền `GEMINI_API_KEY` (miễn phí tại https://aistudio.google.com/apikey) hoặc `OPENAI_API_KEY` vào `backend/.env`, khởi động lại backend.
Không có key, chatbot vẫn chạy ở **chế độ offline**: gợi ý theo từ khóa, khẩu vị, ngân sách và vẫn hiểu câu "thêm 2 gói … vào giỏ".

### Tài khoản & dữ liệu demo
| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin@beanbrew.vn` | `admin123` |
| Khách hàng | `user@beanbrew.vn` | `user123` |

- Mã giảm giá: `WELCOME10` (−10%), `BEAN20` (−20% đơn từ 500k)
- Thẻ test: `4242 4242 4242 4242` (thành công), `4000 0000 0000 0002` (bị từ chối)

### Chạy test
```bash
cd backend && .venv\Scripts\python -m pytest -q
```

---

## ✅ Chức năng

### Trải nghiệm 3D kiểu Dogstudio + Aristide Benoist (trang chủ)
- **Tách cà phê 3D dựng hoàn toàn bằng code (three.js)**: sứ bóng phản chiếu, latte art, 90 hạt cà phê có rãnh, khói & bụi sáng bằng shader GPU; xoay theo chuột
- **Kể chuyện theo cuộn (3 chương)**: camera bay quanh tách, hạt đổ xoáy vào tách, nền đổi màu, chữ lớn kiểu tạp chí trượt lên từng dòng, tách & chữ đổi bên mỗi chương
- Cuộn mượt có quán tính (Lenis), hiệu ứng ảnh gợn như mặt nước khi rê chuột, film grain; three.js chỉ tải ở trang chủ, có ảnh dự phòng khi máy không hỗ trợ WebGL

### Trang chủ (giới thiệu) và Cửa hàng (mua sắm) tách riêng
- **Trang chủ** chỉ giới thiệu: hero trình chiếu, đoạn giới thiệu sáng dần theo cuộn, **video giới thiệu** (phóng to toàn màn hình khi cuộn, bấm để xem đầy đủ), **"Hành trình hạt cà phê" cuộn ngang** qua 4 video, khám phá danh mục, menu đồ uống, 2 hàng sản phẩm tiêu biểu chạy ngược chiều, câu chuyện, cảm nhận khách hàng, lời mời "Vào cửa hàng"
- **Cửa hàng** (`/shop`): banner theo danh mục, nút lọc nhanh, bộ lọc giá, lưới sản phẩm để chọn và mua
- **63 sản phẩm** (16 loại cà phê hạt) – nguồn ảnh/video xem [docs/CREDITS.md](docs/CREDITS.md)
- Hiệu ứng toàn trang: màn hình chào, con trỏ tùy biến, gợn sóng khi bấm nút, nút về đầu trang có vòng tiến trình, pháo giấy khi đặt hàng thành công

### Khách hàng
- Đăng ký / đăng nhập JWT, hồ sơ, đổi mật khẩu, **quên mật khẩu** (link dùng 1 lần, hết hạn sau 15 phút)
- Trang chủ: hero, danh mục, sản phẩm nổi bật, bán chạy
- Cửa hàng: **tìm kiếm không dấu**, gợi ý tức thì, lọc danh mục / khoảng giá / còn hàng, 5 kiểu sắp xếp, phân trang; bộ lọc lưu trên URL
- Chi tiết sản phẩm: gallery ảnh, **chọn khối lượng (250g/500g/1kg) và kiểu xay** (giá và tồn kho đổi theo lựa chọn), đánh giá, sản phẩm liên quan
- **Đồ uống pha chế**: chọn **size S/M/L, mức đá (nóng → nhiều đá), mức đường (0–100%), topping** (tối đa 3 phần/loại, 5 phần/ly); giá cộng topping cập nhật tức thì, server tính lại khi đặt hàng
- **Đánh giá chỉ dành cho khách đã nhận hàng**, chống đánh giá ảo
- **Danh sách yêu thích** (lưu theo tài khoản)
- Giỏ hàng: thêm/sửa/xóa theo từng phân loại, tự đồng bộ giá & tồn kho, thanh tiến độ freeship
- Thanh toán: mã giảm giá; COD / thẻ (kiểm tra Luhn) / **QR có bước xác nhận chuyển khoản**
- Đơn hàng: lọc theo trạng thái, timeline *Đang xử lý → Đang giao → Đã hoàn thành*, hủy đơn, mua lại
- **Dark mode** (theo hệ điều hành hoặc tự chọn), responsive mobile
- **Hero trình chiếu động** (lấy cảm hứng từ thiết kế du lịch): 4 cảnh tự chuyển, chữ khổng lồ chạy từng ký tự, **vật thể đè lên chữ** (giả lập tách nền bằng CSS mask), parallax theo chuột và cuộn, thanh menu kính mờ, thẻ xem trước cảnh tiếp theo có thanh tiến trình, điều khiển bằng phím ←/→
- Thanh tiến trình cuộn trang, thẻ sản phẩm **nghiêng 3D + vệt sáng** theo chuột, nút "nam châm" hút theo con trỏ
- **Animation**: hero Ken Burns + chữ hiện lần lượt, số liệu đếm tăng, hạt cà phê bay, băng chữ chạy, các khối hiện dần khi cuộn, ảnh sản phẩm **bay vào giỏ hàng**, chuyển trang mượt; tự tắt khi hệ điều hành bật *giảm chuyển động*

### Quản trị viên (`/admin`)
- Dashboard: doanh thu, số đơn, khách hàng, giá trị TB/đơn, biểu đồ 7/14/30 ngày, tỉ lệ trạng thái, top bán chạy, cảnh báo sắp hết hàng
- **Thông báo đơn mới tức thì** (toast + âm báo + badge số đơn chờ), dashboard tự cập nhật
- Sản phẩm (CRUD): upload ảnh, **trình chỉnh sửa phân loại**, bật/tắt nhanh còn/hết hàng, ẩn/hiện, nổi bật
- Đơn hàng: lọc, tìm kiếm, cập nhật trạng thái theo đúng luồng, **xuất CSV** theo khoảng ngày (mở được bằng Excel)
- Danh mục (CRUD), **Topping (CRUD, tạm ngưng)**, Khách hàng (số đơn, tổng chi tiêu), Mã giảm giá (bật/tắt)

### Nâng cao – AI Chatbot (`POST /api/chat`, `POST /api/chat/stream`)
- System prompt chứa vai trò, quy tắc, chính sách, mã giảm giá, **toàn bộ sản phẩm kèm giá từng phân loại**, tên khách và **giỏ hàng hiện tại**
- **Streaming**: chữ hiện dần như ChatGPT
- **Function calling** `add_to_cart`: khách nói "lấy 2 gói Ethiopia 250g xay pour-over" hoặc "1 trà sữa size L ít đá 50% đường thêm kem cheese" thì AI gọi hàm, server **kiểm tra lại** sản phẩm, phân loại và tồn kho, sau đó frontend mới thêm vào giỏ. Thiếu thông tin phân loại thì AI hỏi lại khách.
- Fallback: Gemini → OpenAI → offline, nên khi demo chatbot luôn trả lời được

## ✨ Điểm nhấn kỹ thuật
1. **Giá luôn do server tính**: client chỉ gửi `product_id`, `variant_id`, `quantity`
2. **Tồn kho theo từng phân loại**: trừ khi đặt, hoàn khi hủy, chặn bán vượt kho (`SELECT … FOR UPDATE`)
3. **Máy trạng thái đơn hàng**: không nhảy cóc trạng thái, đơn trả trước chưa thanh toán thì không được giao
4. **Snapshot đơn hàng**: lưu tên, phân loại, giá tại thời điểm mua
5. **Không tin tuyệt đối vào AI**: mọi hành động AI yêu cầu đều được server kiểm tra lại
6. Realtime bằng SSE (đơn giản hơn WebSocket vì chỉ cần một chiều server → client)
7. Dark mode bằng cách đổi biến màu CSS, không phải sửa từng component
8. 22 test pytest; lịch sử Git ghi lại từng giai đoạn làm việc với AI
9. **Chạy được khi không có mạng**: ảnh, video, phông chữ, mã QR đều nằm trong dự án; chatbot tự chuyển sang chế độ trả lời offline (chỉ phần gọi Gemini/OpenAI cần Internet)

📖 Tài liệu thêm: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (kiến trúc, luồng dữ liệu, câu hỏi vấn đáp), [docs/VIBE_CODING.md](docs/VIBE_CODING.md) (quy trình làm việc với AI và các lỗi đã phát hiện).

## 📁 Cấu trúc thư mục
```
backend/
  app/
    main.py          # khởi tạo FastAPI, CORS, đăng ký router
    config.py        # đọc cấu hình từ .env
    database.py      # engine, session, get_db
    models.py        # bảng CSDL (ORM)
    schemas.py       # Pydantic: validate input / định dạng output
    security.py      # bcrypt, JWT, token đặt lại mật khẩu, phân quyền
    services.py      # logic dùng chung (coupon, shipping, slug, rating, phân loại)
    events.py        # pub/sub cho thông báo realtime
    routers/         # auth, products, orders, admin, chat, wishlist
  seed.py            # dữ liệu mẫu
  tests/test_api.py  # kiểm thử API
frontend/src/
  api/               # axios client, đọc stream chat/admin, kiểu dữ liệu TypeScript
  store/             # Zustand: auth, cart, wishlist, theme, adminEvents
  components/        # Layout, ProductCard, ChatWidget, ThemeToggle, UI dùng chung
  pages/             # trang khách hàng
  pages/admin/       # trang quản trị
docker-compose.yml   # chạy cả hệ thống bằng Docker
```
