# Kiến trúc hệ thống Bean & Brew

> Tài liệu chuẩn bị cho phần **vấn đáp / bảo vệ**: kiến trúc, luồng dữ liệu, các quyết định thiết kế và câu hỏi thường gặp.

## 1. Tổng quan kiến trúc

Hệ thống theo mô hình **tách biệt Client / Server** (SPA + REST API):

```
┌──────────────────────────┐   HTTP/JSON (axios)    ┌───────────────────────────────┐
│  Trình duyệt (React SPA) │ ─────────────────────► │  FastAPI (uvicorn :8000)      │
│  localhost:5173 (Vite)   │   Authorization:       │                               │
│                          │   Bearer <JWT>         │  Router ─► Schema ─► Service  │
│  Pages ─ Components      │ ◄───────────────────── │     │                         │
│  Zustand store (auth,    │                        │     ▼                         │
│  cart) ↔ localStorage    │                        │  SQLAlchemy ORM ─► SQLite/MySQL│
└──────────────────────────┘                        │     │                         │
                                                    │     └─► httpx ─► Gemini/OpenAI │
                                                    └───────────────────────────────┘
```

- Khi dev, **Vite proxy** chuyển `/api/*` và `/uploads/*` sang `127.0.0.1:8000` → frontend và backend coi như cùng origin, không vướng CORS. Backend vẫn bật CORS cho trường hợp deploy tách domain.
- Backend chia lớp:
  | Lớp | File | Vai trò |
  |---|---|---|
  | Router (Controller) | `app/routers/*.py` | Nhận request, gọi dependency (DB, user), trả response |
  | Schema (DTO) | `app/schemas.py` | Pydantic kiểm tra dữ liệu vào (VD: SĐT phải `^0\d{9,10}$`), định dạng dữ liệu ra |
  | Service | `app/services.py` | Logic dùng chung: tính giảm giá, phí ship, slug, điểm đánh giá |
  | Model | `app/models.py` | Ánh xạ bảng CSDL bằng SQLAlchemy ORM |
  | Security | `app/security.py` | bcrypt, tạo/giải mã JWT, dependency `get_current_user`, `require_admin` |

## 2. Cơ sở dữ liệu

```
users ──< orders ──< order_items >── products >── categories
  │                                     │
  └──────────< reviews >────────────────┘
coupons (độc lập, tham chiếu theo code)
```

| Bảng | Trường chính | Ghi chú |
|---|---|---|
| `users` | email (unique), hashed_password, role (`customer`/`admin`) | Mật khẩu băm bcrypt, không lưu plain text |
| `categories` | name, slug, icon | |
| `products` | price, original_price, stock, is_active, is_featured, sold_count, rating_avg, search_text | `search_text` = văn bản không dấu phục vụ tìm kiếm |
| `orders` | code, status, payment_method, payment_status, subtotal, discount, shipping_fee, total | |
| `order_items` | product_id (nullable), product_name, unit_price, quantity | **Snapshot** tên/giá lúc mua |
| `reviews` | rating 1–5, comment, unique(user_id, product_id) | Mỗi người 1 đánh giá / sản phẩm |
| `coupons` | code, discount_percent, max_discount, min_order, is_active | |

**Vì sao snapshot ở `order_items`?** Nếu admin đổi giá hoặc xóa sản phẩm, lịch sử đơn hàng và doanh thu cũ vẫn đúng. Khi xóa sản phẩm, `product_id` được set `NULL` nhưng tên/giá vẫn còn.

**Vì sao denormalize `rating_avg`, `sold_count`?** Để sắp xếp "Đánh giá cao", "Bán chạy" nhanh mà không phải JOIN + GROUP BY mỗi lần liệt kê. Được cập nhật lại mỗi khi có đánh giá (`recalc_rating`) / đặt / hủy đơn.

## 3. Luồng dữ liệu chính

### 3.1 Đăng nhập & xác thực JWT
1. `Login.tsx` gửi `POST /api/auth/login {email, password}`.
2. Backend tìm user, `bcrypt.checkpw` so mật khẩu → tạo JWT `{sub: user_id, role, exp}` ký bằng `JWT_SECRET` (HS256).
3. Frontend lưu `token + user` vào Zustand store `useAuth` (persist → localStorage).
4. Axios **request interceptor** tự gắn `Authorization: Bearer <token>` vào mọi request.
5. Endpoint cần đăng nhập khai báo `Depends(get_current_user)` → giải mã token, lấy user từ DB; sai/hết hạn → **401**. Endpoint admin dùng `require_admin` → không phải admin → **403**.
6. Axios **response interceptor** gặp 401 → tự đăng xuất.
7. Phía giao diện, `RequireAuth` trong `App.tsx` chặn route `/checkout`, `/orders`, `/admin`… (chỉ là UX; bảo mật thật nằm ở backend).

### 3.2 Duyệt & tìm kiếm sản phẩm
`Shop.tsx` đọc bộ lọc từ **URL query** (`?q=&category=&min_price=&sort=&page=`) → `GET /api/products` → backend build câu `SELECT` động:
- `q` được bỏ dấu (`strip_accents`) rồi so khớp từng từ với cột `search_text` (LIKE) → "ca phe dam" tìm ra "Cà phê ... đậm".
- Đếm `total` bằng subquery, phân trang bằng `OFFSET/LIMIT`, trả về `{items, total, page, pages}`.

### 3.3 Giỏ hàng
- Lưu **phía client** (Zustand + localStorage) → không cần đăng nhập vẫn thêm giỏ được, không tốn request.
- Khi mở trang giỏ, frontend gọi lại `GET /api/products/{id}` để đồng bộ giá/tồn kho mới nhất.
- Giá trong giỏ chỉ để hiển thị; **giá cuối cùng luôn do server tính** khi đặt hàng.

### 3.4 Đặt hàng (`POST /api/orders`) – luồng quan trọng nhất
```
Client gửi: items [{product_id, quantity}], địa chỉ, payment_method, coupon_code, card_number
   │
   ▼
1. Gộp dòng trùng sản phẩm
2. SELECT products ... FOR UPDATE   (khóa dòng trên MySQL/Postgres, tránh 2 người mua món cuối cùng)
3. Với mỗi sản phẩm: kiểm tra còn bán + đủ tồn kho → lấy GIÁ TỪ DB → tạo OrderItem (snapshot)
4. Tính coupon (min_order, % giảm, giảm tối đa) → phí ship (miễn phí nếu ≥ 500k sau giảm)
5. Thanh toán giả lập: COD → unpaid | QR → paid | Thẻ → kiểm tra Luhn, thẻ 4000…0002 → 402 từ chối
6. Trừ stock, cộng sold_count
7. INSERT order + items → COMMIT (1 transaction: lỗi ở bất kỳ bước nào → không có gì được ghi)
```
Frontend nhận đơn → xóa giỏ → chuyển tới `/orders/{code}?success=1`.

### 3.5 Trạng thái đơn hàng (state machine)
```
pending (Đang xử lý) ──► shipping (Đang giao) ──► completed (Đã hoàn thành)
      │                        │
      └──────► cancelled ◄─────┘
```
- Khách chỉ hủy được khi `pending`. Admin chuyển theo `ALLOWED_TRANSITIONS` (`routers/admin.py`); sai luồng → 400.
- Hủy → `restore_stock` hoàn kho, đơn đã thanh toán → `refunded`. COD hoàn thành → `paid`.

### 3.6 Thống kê (`GET /api/admin/stats`)
Dùng hàm tổng hợp SQL: `SUM(total)`, `COUNT`, `GROUP BY DATE(created_at)` (doanh thu theo ngày, điền 0 cho ngày trống), `GROUP BY status`, top sản phẩm theo `SUM(quantity)`. **Doanh thu = tổng các đơn không bị hủy.**

### 3.7 AI Chatbot (`POST /api/chat`)
```
ChatWidget ─► POST /api/chat {messages: 12 tin gần nhất}
                │
                ▼
1. Lấy sản phẩm đang bán + coupon đang bật từ DB
2. build_system_prompt(): vai trò "Bean – nhân viên tư vấn", 6 quy tắc (chỉ giới thiệu sản phẩm có thật,
   không bán hàng hết, tối đa 3 gợi ý, tiếng Việt…), chính sách ship/thanh toán, danh sách sản phẩm
3. Gọi Gemini (generateContent, system_instruction) → lỗi thì OpenAI (chat/completions) → lỗi thì offline
4. find_mentioned(): dò tên sản phẩm trong câu trả lời → trả kèm danh sách sản phẩm
                │
                ▼
ChatWidget render markdown + thẻ sản phẩm có nút "Thêm vào giỏ"
```
- Đây là kỹ thuật **context injection** (một dạng RAG đơn giản): vì catalog nhỏ (~24 sản phẩm) nên đưa toàn bộ vào prompt; catalog lớn thì sẽ lọc trước bằng tìm kiếm rồi mới đưa top-N vào.
- API key chỉ nằm ở backend (`.env`), **không bao giờ lộ ra trình duyệt**.
- Chế độ offline: chấm điểm sản phẩm theo từ khóa khớp `search_text`, ý định (đậm/nhẹ/rẻ/ship/mã giảm giá) và ngân sách ("dưới 200k").

## 4. Frontend

| Thư mục | Nội dung |
|---|---|
| `api/client.ts` | axios instance + interceptor JWT + `errorMessage()` đọc lỗi FastAPI |
| `api/types.ts` | interface TypeScript khớp với Pydantic schema |
| `store/auth.ts`, `store/cart.ts` | Zustand + `persist` (localStorage) |
| `components/` | `Layout` (header, search gợi ý, footer), `ProductCard`, `ChatWidget`, `ui.tsx` (Modal, Pagination, Stars…) |
| `pages/`, `pages/admin/` | Mỗi trang tự fetch dữ liệu bằng `useEffect` |

- **Routing**: React Router 7, layout lồng nhau (`Layout` cho khách, `AdminLayout` cho admin).
- **Code-splitting**: trang admin `lazy()` → khách hàng không phải tải thư viện biểu đồ.
- **State**: server state fetch trực tiếp; client state (auth, giỏ) ở Zustand — đơn giản hơn Redux, đủ cho quy mô này.
- **UI**: Tailwind 4 với theme màu cà phê tự định nghĩa (`@theme` trong `index.css`), font Be Vietnam Pro hỗ trợ tiếng Việt.

## 5. Câu hỏi vấn đáp thường gặp

**H: Tại sao chọn FastAPI?** – Nhanh, khai báo kiểu bằng Python type hints → tự validate & tự sinh Swagger (`/docs`), hệ thống Dependency Injection (`Depends`) gọn cho DB session và phân quyền.

**H: JWT khác session thế nào?** – JWT không lưu trạng thái trên server; server chỉ cần kiểm tra chữ ký bằng secret. Nhược điểm: không thu hồi được trước hạn (có thể khắc phục bằng blacklist hoặc refresh token ngắn hạn).

**H: Nếu người dùng sửa giá trong localStorage?** – Không ảnh hưởng: API đặt hàng chỉ nhận `product_id` + `quantity`, giá lấy từ DB.

**H: Hai người cùng mua sản phẩm cuối cùng?** – Kiểm tra tồn kho và trừ kho nằm trong cùng transaction với `SELECT ... FOR UPDATE`; người thứ hai sẽ nhận lỗi "chỉ còn 0 sản phẩm". (SQLite khóa cả DB khi ghi nên cũng an toàn ở môi trường dev.)

**H: Tại sao lưu mật khẩu bằng bcrypt?** – Hàm băm chậm có salt ngẫu nhiên → chống rainbow table và brute-force; không thể giải ngược.

**H: Đổi sang MySQL thế nào?** – `pip install pymysql`, đặt `DATABASE_URL=mysql+pymysql://user:pass@host/db` trong `.env`. ORM không cần sửa code.

**H: Chatbot có bịa sản phẩm không?** – System prompt yêu cầu chỉ dùng sản phẩm trong danh sách, viết đúng tên; thẻ sản phẩm chỉ hiện khi tên khớp với DB nên khách luôn bấm được vào sản phẩm thật.

**H: Làm sao biết code AI sinh ra đúng?** – Bộ `pytest` 10 test kiểm tra các nghiệp vụ cốt lõi (tính tiền, coupon, tồn kho, phân quyền, luồng trạng thái, thanh toán thẻ, chatbot offline) + chạy thử bằng trình duyệt tự động.
