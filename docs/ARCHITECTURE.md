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
  │                        │            │  └──< product_variants (250g / 500g / 1kg)
  │                        └────────────┼──────> (order_items.variant_id)
  ├──────────< reviews >────────────────┤
  └──────────< wishlists >──────────────┘
coupons (độc lập, tham chiếu theo code)
```

| Bảng | Trường chính | Ghi chú |
|---|---|---|
| `users` | email (unique), hashed_password, role (`customer`/`admin`) | Mật khẩu băm bcrypt, không lưu plain text |
| `categories` | name, slug, icon | |
| `products` | price, original_price, stock, is_active, is_featured, sold_count, rating_avg, search_text | `search_text` = văn bản không dấu phục vụ tìm kiếm |
| `orders` | code, status, payment_method, payment_status, subtotal, discount, shipping_fee, total | |
| `product_variants` | product_id, label, price, original_price, stock | Mỗi phân loại một giá + tồn kho riêng. Sản phẩm có phân loại: `products.price` = giá thấp nhất, `products.stock` = tổng (đồng bộ bằng `sync_from_variants()`) |
| `order_items` | product_id, variant_id (nullable), product_name, variant_label, unit_price, quantity | **Snapshot** tên/phân loại/giá lúc mua (VD `variant_label = "500g · Xay phin"`) |
| `wishlists` | user_id, product_id, unique(user_id, product_id) | Danh sách yêu thích theo tài khoản |
| `toppings` | name, price, is_active | Topping cho đồ uống; `products.is_drink` bật chọn đá/đường, `products.allow_toppings` bật topping |
| `order_items.options_json` | `{grind, sugar, ice, toppings:[{id,name,price,quantity}]}` | Snapshot tùy chọn → "Mua lại" đúng y như cũ, xóa topping không làm sai đơn cũ |
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
Client gửi: items [{product_id, variant_id, grind, quantity}], địa chỉ, payment_method, coupon_code, card_number
   │
   ▼
1. Gộp dòng trùng (cùng sản phẩm + phân loại + kiểu xay)
2. SELECT products ... FOR UPDATE   (khóa dòng trên MySQL/Postgres, tránh 2 người mua món cuối cùng)
3. Mỗi dòng: sản phẩm còn bán? có phân loại thì bắt buộc variant_id hợp lệ; kiểu xay thuộc danh sách cho phép?
   cộng dồn nhu cầu theo từng phân loại -> đủ tồn kho? -> lấy GIÁ TỪ DB -> tạo OrderItem (snapshot)
4. Tính coupon (min_order, % giảm, giảm tối đa) → phí ship (miễn phí nếu ≥ 500k sau giảm)
5. Thanh toán giả lập: COD → unpaid | QR → unpaid (chờ xác nhận) | Thẻ → kiểm tra Luhn, 4000…0002 → 402
6. Trừ stock của phân loại (hoặc sản phẩm), cộng sold_count, đồng bộ lại giá/tồn kho tổng
7. INSERT order + items → COMMIT (1 transaction) → phát sự kiện "new_order" cho admin
```
Frontend nhận đơn → xóa giỏ → chuyển tới `/orders/{code}?success=1`. Đơn QR hiện mã QR + nút "Tôi đã chuyển khoản" (`POST /orders/{code}/pay`, giả lập webhook ngân hàng).

### 3.4b Tùy chọn đồ uống (size / đá / đường / topping)
- Mức đá/đường cố định trong `schemas.py` (`ICE_OPTIONS`, `SUGAR_OPTIONS`), topping lưu DB; frontend lấy tất cả qua `GET /api/meta` → không hard-code 2 nơi.
- `services.resolve_line_options()` là **một hàm duy nhất** kiểm tra mọi tùy chọn (đúng loại sản phẩm, mức hợp lệ, topping đang bán, ≤3 phần/loại, ≤5 phần/ly) và tính tiền topping; dùng chung cho **đặt hàng** và **chatbot**.
- Giá 1 ly = giá size + Σ(giá topping × số phần). Client chỉ gửi id + số lượng.
- Giỏ hàng: mỗi dòng có `key` = sản phẩm + size + đá + đường + topping → 2 ly khác đường là 2 dòng riêng.

### 3.5 Trạng thái đơn hàng (state machine)
```
pending (Đang xử lý) ──► shipping (Đang giao) ──► completed (Đã hoàn thành)
      │                        │
      └──────► cancelled ◄─────┘
```
- Khách chỉ hủy được khi `pending`. Admin chuyển theo `ALLOWED_TRANSITIONS` (`routers/admin.py`); sai luồng → 400.
- Đơn trả trước (thẻ/QR) **chưa thanh toán** thì admin không chuyển sang "Đang giao" được.
- Hủy → `restore_stock` hoàn kho, đơn đã thanh toán → `refunded`. COD hoàn thành → `paid`.

### 3.6 Thống kê (`GET /api/admin/stats`)
Dùng hàm tổng hợp SQL: `SUM(total)`, `COUNT`, `GROUP BY DATE(created_at)` (doanh thu theo ngày, điền 0 cho ngày trống), `GROUP BY status`, top sản phẩm theo `SUM(quantity)`. **Doanh thu = tổng các đơn không bị hủy.**

### 3.7 AI Chatbot (`POST /api/chat/stream`, `POST /api/chat`)
```
ChatWidget ─► POST /api/chat/stream {messages: 12 tin gần nhất, cart: giỏ hiện tại}  (+ JWT nếu đã đăng nhập)
                │
                ▼
1. load_context(): sản phẩm đang bán (kèm phân loại), coupon đang bật, tên khách, giỏ hàng
2. build_system_prompt(): vai trò "Bean", 6 quy tắc (chỉ dùng sản phẩm có thật, không bán hàng hết, tối đa
   3 gợi ý, gọi add_to_cart khi khách muốn mua, thiếu phân loại thì hỏi lại…), chính sách, danh sách sản phẩm
3. stream_gemini(): streamGenerateContent?alt=sse, khai báo tool add_to_cart(product_id, quantity, variant, grind)
   → lỗi thì stream_openai() → lỗi thì offline_reply()
4. Mỗi mảnh chữ → sự kiện {"type":"delta"} đẩy ngay về trình duyệt
5. AI gọi tool → resolve_add_to_cart() KIỂM TRA LẠI id, phân loại, kiểu xay, tồn kho
   → hợp lệ: {"type":"action"} kèm sản phẩm   | không hợp lệ: câu hỏi lại / báo hết hàng
6. find_mentioned() dò tên sản phẩm trong câu trả lời → {"type":"products"} → {"type":"done"}
                │
                ▼
ChatWidget (fetch + ReadableStream): nối chữ dần, nhận "action" thì thêm vào giỏ (Zustand), hiện thẻ sản phẩm
```
- **Function calling**: thay vì bắt AI viết theo định dạng đặc biệt rồi tự phân tích chữ, ta khai báo hàm (tên, mô tả, kiểu tham số); model tự quyết định khi nào gọi và trả về tham số có cấu trúc. Server **không tin tuyệt đối**, luôn kiểm tra lại trước khi hành động.
- **Context injection** (một dạng RAG đơn giản): catalog nhỏ (~24 sản phẩm) nên đưa toàn bộ vào prompt; catalog lớn thì lọc trước bằng tìm kiếm rồi mới đưa top-N vào.
- `POST /api/chat` (trả JSON, đúng yêu cầu đề bài) và `/api/chat/stream` (SSE) dùng **chung một async generator** `chat_events()`, nên logic không bị viết hai lần.
- Toàn bộ dữ liệu nạp từ DB **trước** khi bắt đầu stream, vì session DB sẽ đóng khi handler trả về StreamingResponse.
- API key chỉ nằm ở backend (`.env`), **không bao giờ lộ ra trình duyệt**.
- Chọn model `gemini-3.5-flash-lite` sau khi đo: khoảng 3 giây/câu và gọi hàm chính xác, trong khi `gemini-3.8-flash` mất khoảng 60 giây.
- Chế độ offline: chấm điểm sản phẩm theo từ khóa khớp `search_text`, ý định (đậm/nhẹ/rẻ/ship/mã giảm giá/thêm vào giỏ) và ngân sách ("dưới 200k").

### 3.8 Thông báo realtime cho admin (`GET /api/admin/stream`)
```
Khách đặt hàng ─► create_order() commit ─► broker.publish({"type":"new_order", ...})
                                               │  (call_soon_threadsafe vì handler sync chạy trong threadpool)
                                               ▼
                         asyncio.Queue của từng admin đang mở trang ─► SSE "data: {...}"
                                               ▼
AdminLayout: toast + âm báo, badge số đơn chờ; store.version++ → Dashboard & trang Đơn hàng tự tải lại
```
- Chọn **SSE thay vì WebSocket**: chỉ cần một chiều server → client, chạy trên HTTP thường, trình duyệt có thể tự kết nối lại; frontend dùng `fetch` để gửi được header `Authorization`.
- Gửi `: ping` mỗi 15 giây để proxy không cắt kết nối. Nginx phải đặt `proxy_buffering off`.
- Broker lưu trong bộ nhớ, đủ cho 1 tiến trình; chạy nhiều tiến trình/server thì thay bằng Redis pub/sub.

### 3.9 Quên / đặt lại mật khẩu
- `POST /api/auth/forgot-password` tạo JWT `{purpose:"reset", pwf: sha256(hashed_password)[:16], exp: 15 phút}`. Luôn trả cùng một thông báo, dù email có tồn tại hay không, để không lộ email nào đã đăng ký.
- **Dùng 1 lần**: `pwf` là dấu vân tay của mật khẩu hiện tại. Đổi mật khẩu xong thì dấu vân tay khác đi, nên token cũ tự vô hiệu mà không cần lưu gì trong DB.
- Token có `purpose` nên **không dùng thay access token** được.
- Chế độ demo (`DEMO_MODE=true`): trả link ngay trong response thay vì gửi email.

## 4. Frontend

| Thư mục | Nội dung |
|---|---|
| `api/client.ts` | axios instance + interceptor JWT + `errorMessage()` đọc lỗi FastAPI |
| `api/chat.ts`, `api/adminStream.ts` | đọc Server-Sent Events bằng `fetch` + `ReadableStream`, tự kết nối lại |
| `api/types.ts` | interface TypeScript khớp với Pydantic schema |
| `store/auth.ts`, `store/cart.ts` | Zustand + `persist` (localStorage). Mỗi dòng giỏ có `key = sản phẩm + phân loại + kiểu xay` |
| `store/wishlist.ts` | id sản phẩm yêu thích, cập nhật lạc quan (optimistic) rồi hoàn tác nếu API lỗi |
| `store/theme.ts`, `store/adminEvents.ts` | theme sáng/tối; sự kiện realtime + `version` để trang admin tự tải lại |
| `components/` | `Layout` (header, search gợi ý, footer), `ProductCard`, `ChatWidget`, `ThemeToggle`, `ui.tsx` (Modal, Pagination, Stars…) |
| `pages/`, `pages/admin/` | Mỗi trang tự fetch dữ liệu bằng `useEffect` |

- **Routing**: React Router 7, layout lồng nhau (`Layout` cho khách, `AdminLayout` cho admin).
- **Code-splitting**: trang admin `lazy()` → khách hàng không phải tải thư viện biểu đồ.
- **State**: server state fetch trực tiếp; client state (auth, giỏ) ở Zustand — đơn giản hơn Redux, đủ cho quy mô này.
- **UI**: Tailwind 4 với theme màu cà phê tự định nghĩa (`@theme` trong `index.css`), font Be Vietnam Pro hỗ trợ tiếng Việt.
- **Dark mode**: Tailwind 4 biên dịch mỗi màu thành biến CSS (`--color-coffee-900`…). Lớp `.dark` trên `<html>` chỉ cần **định nghĩa lại các biến** (đảo thang màu coffee, đổi `--color-surface`), nên mọi component tự đổi theo. Vùng luôn tối (hero, footer, sidebar) dùng token cố định `espresso`/`latte`. Script nhỏ trong `index.html` đặt theme trước khi React chạy để không bị nháy.

- **Animation**: không dùng thư viện. `useInView` (IntersectionObserver) + component `<Reveal>` cho hiệu ứng hiện dần khi cuộn (có `delay` để chạy lần lượt); `useCountUp` (requestAnimationFrame) cho số liệu; `flyToCart` (Web Animations API) nhân bản ảnh bay theo đường cong tới `[data-cart-icon]`; keyframes trong `index.css`. Tôn trọng `prefers-reduced-motion`. Lưu ý: `will-change: transform` tạo containing block làm lệch phần tử `position: fixed`, nên bỏ sau khi chạy xong.

- **Hero slider** (`components/HeroSlider.tsx`): 3 lớp chồng nhau – ảnh nền → chữ khổng lồ → **bản sao ảnh có `mask-image: radial-gradient(...)`** chỉ lộ vùng vật thể chính, nên vật thể trông như đứng trước chữ mà không cần ảnh PNG tách nền. `useParallax` ghi biến CSS `--mx/--my/--sy` mỗi khung hình (không re-render React); mỗi lớp dịch với hệ số khác nhau → chiều sâu. Thời gian mỗi cảnh gắn với chính animation của thanh tiến trình (`onAnimationEnd` → cảnh kế), nên tạm dừng khi rê chuột chỉ cần `animation-play-state: paused`.
- Chữ dùng `background-clip: text` với gradient mờ dần; phải nới `padding-top` của từng ký tự vì nền chỉ phủ trong hộp phần tử – nếu không, dấu tiếng Việt (À, Ê, Ữ) nằm ngoài hộp sẽ biến mất.

- **Hiệu ứng theo cuộn** dùng chung hook `useScrollProgress` (ghi biến `--p` 0..1, không re-render): video phóng to (`width/border-radius` tính bằng `calc()` theo `--p`), đoạn văn sáng dần (mỗi chữ có `--i`, `opacity: clamp(...)`), ảnh câu chuyện parallax, và **cuộn ngang ghim** (section cao 320vh, phần trong `position: sticky`, track dịch `translateX(-p × độ dài thừa)`; màn hình nhỏ chuyển sang xếp dọc).
- Video chỉ tải/phát khi lọt vào màn hình (`IntersectionObserver` → `play()/pause()`, `preload="none"`) để tiết kiệm băng thông.
- Pháo giấy: `<canvas>` + vật lý đơn giản (vận tốc, trọng lực, lực cản), tự hủy sau 3 giây.

### Cảnh 3D (`components/three/CoffeeScene.ts`, `components/home/Immersive3D.tsx`)
- **Không dùng file mô hình**: tách & đĩa = `LatheGeometry` (xoay đường biên dạng quanh trục); hạt = hình cầu bóp thành elip rồi **dịch đỉnh** tạo rãnh chữ S; ~28 hạt vẽ bằng **`InstancedMesh`** (1 lần gọi vẽ), vị trí rải bằng *rejection sampling* để không che tách và không lấn vùng chữ; **sương mù (`Fog`)** cùng màu nền làm hạt xa chìm dần → chiều sâu; latte art trái tim vẽ bằng Canvas 2D; **khói** là dải mặt phẳng + nhiễu **fbm** trong fragment shader, luôn quay về camera; bụi sáng là `Points` + shader GLSL.
- Ánh sáng kiểu chụp sản phẩm: **studio ảo** (phòng tối + các tấm đèn phát sáng, đưa qua PMREM) làm môi trường phản chiếu nên sứ có vệt sáng dài như ảnh quảng cáo; đèn chính ấm có **shadow map** (bóng tách đổ lên đĩa, đèn đi theo tách) + đèn viền cam & hồng; tone mapping ACES.
- Chuyển động: màn mở đầu (tách bay lên & xoay theo `easeOutBack`, mặt cà phê dâng lên với bán kính khít lòng tách, hạt bung ra lần lượt) và **bấm vào tách** (raycast → tách xoay 1 vòng, hạt văng ra rồi về chỗ).
- Vị trí tách tính theo **độ rộng khung nhìn** (`tan(fov/2)·khoảng cách·aspect`) → màn hình càng rộng tách càng ra xa giữa, chữ lớn không bao giờ đè lên tách; quai tách luôn quay ra phía ngoài.
- **Điều khiển bằng cuộn**: section cao 320vh, phần trong `sticky`; `useScrollProgress` truyền tiến độ 0..1 → camera/tách/hạt nội suy theo 3 chương (`smoothstep`). Nội suy theo **thời gian** `1 - e^(-dt·k)` để máy nhanh hay chậm đều khớp vị trí cuộn. Nền section đổi màu bằng nội suy RGB.
- **Hiệu năng**: three.js nạp động (`import()`, chunk riêng ~124KB gzip) chỉ ở trang chủ; vòng render chỉ chạy khi section hiện trên màn hình (IntersectionObserver); `devicePixelRatio ≤ 2`; vector tạm dùng lại mỗi khung hình; giải phóng geometry/material/texture khi rời trang; lỗi WebGL → ảnh tĩnh.
- **Cuộn mượt (Lenis)** chỉ bật ở trang chủ, tắt khi `prefers-reduced-motion` hoặc màn cảm ứng; popup video gọi `lenis.stop()`; vùng cuộn riêng (khung chat) gắn `data-lenis-prevent`.
- Header tự chuyển kính mờ khi nằm trên vùng tối (`[data-overlay-header]`).

### Hệ thống giao diện chung (đồng bộ mọi trang với trang chủ)
- **`<PageHero>`**: đầu trang tối dùng chung cho Cửa hàng, Giỏ hàng, Thanh toán, Đơn hàng, Yêu thích, Tài khoản – nền espresso + film grain + quầng sáng, tiêu đề serif trượt lên từng dòng, số liệu lớn (`HeroStat`), đường dẫn (breadcrumb). Header luôn `fixed`; trang nào có hero (`hasHero()` trong `Layout`) thì header nổi trong suốt, trang khác được chừa `pt-16`.
- **Màn chuyển trang** (`PageCurtain`): tấm espresso kéo lên khi đổi đường dẫn, kiểu Dogstudio; bỏ qua lần tải đầu.
- **Thẻ sản phẩm** kiểu tạp chí: ảnh dọc 4:5, chữ serif, nút thêm giỏ trượt lên khi rê chuột (`@media (hover:none)` → luôn hiện trên điện thoại).
- **Chi tiết sản phẩm**: ảnh lớn dính khi cuộn + kính lúp (đổi `transform-origin` theo con trỏ), bảng thông số kẻ mảnh, lựa chọn dạng viên thuốc.
- Màn hình rất lớn (≥1800px) phóng cỡ chữ gốc `html` → mọi kích thước `rem` to theo, không còn nội dung bé xíu giữa khoảng trống.

## 4b. Triển khai (Docker)
`docker compose up --build` → nginx (frontend) ở cổng 8080 phục vụ file tĩnh đã build, chuyển `/api` và `/uploads` sang container FastAPI; CSDL SQLite và ảnh upload nằm trong volume nên không mất khi khởi động lại.

## 5. Câu hỏi vấn đáp thường gặp

**H: Tại sao chọn FastAPI?** – Nhanh, khai báo kiểu bằng Python type hints → tự validate & tự sinh Swagger (`/docs`), hệ thống Dependency Injection (`Depends`) gọn cho DB session và phân quyền.

**H: JWT khác session thế nào?** – JWT không lưu trạng thái trên server; server chỉ cần kiểm tra chữ ký bằng secret. Nhược điểm: không thu hồi được trước hạn (có thể khắc phục bằng blacklist hoặc refresh token ngắn hạn).

**H: Nếu người dùng sửa giá trong localStorage?** – Không ảnh hưởng: API đặt hàng chỉ nhận `product_id` + `quantity`, giá lấy từ DB.

**H: Hai người cùng mua sản phẩm cuối cùng?** – Kiểm tra tồn kho và trừ kho nằm trong cùng transaction với `SELECT ... FOR UPDATE`; người thứ hai sẽ nhận lỗi "chỉ còn 0 sản phẩm". (SQLite khóa cả DB khi ghi nên cũng an toàn ở môi trường dev.)

**H: Tại sao lưu mật khẩu bằng bcrypt?** – Hàm băm chậm có salt ngẫu nhiên → chống rainbow table và brute-force; không thể giải ngược.

**H: AI có thể tự ý thêm sản phẩm sai/hết hàng vào giỏ không?** – Không. AI chỉ *đề nghị* gọi `add_to_cart`; server kiểm tra id, phân loại, kiểu xay, tồn kho (và giới hạn số lượng) rồi mới gửi hành động cho frontend. Ngoài ra lúc đặt hàng server còn kiểm tra lại lần nữa.

**H: Vì sao dùng SSE mà không dùng WebSocket?** – Chat streaming và thông báo đơn mới đều là luồng một chiều server → client. SSE chạy trên HTTP thường, đơn giản, qua được proxy; WebSocket hợp hơn khi cần hai chiều liên tục (VD chat giữa người với người).

**H: Token đặt lại mật khẩu dùng 1 lần mà không lưu DB thế nào?** – Token chứa dấu vân tay của mật khẩu đang dùng; đổi mật khẩu xong dấu vân tay đổi, nên token cũ không còn khớp.

**H: Chống đánh giá ảo thế nào?** – `POST /reviews` chỉ chấp nhận khi người dùng có đơn **đã hoàn thành** chứa sản phẩm đó; mỗi người chỉ 1 đánh giá/sản phẩm (unique constraint).

**H: Đổi sang MySQL thế nào?** – `pip install pymysql`, đặt `DATABASE_URL=mysql+pymysql://user:pass@host/db` trong `.env`. ORM không cần sửa code.

**H: Chatbot có bịa sản phẩm không?** – System prompt yêu cầu chỉ dùng sản phẩm trong danh sách, viết đúng tên; thẻ sản phẩm chỉ hiện khi tên khớp với DB nên khách luôn bấm được vào sản phẩm thật.

**H: Làm sao biết code AI sinh ra đúng?** – Bộ `pytest` 22 test kiểm tra các nghiệp vụ cốt lõi (tính tiền, coupon, tồn kho theo phân loại, phân quyền, luồng trạng thái, thanh toán thẻ/QR, chống đánh giá ảo, wishlist, đặt lại mật khẩu, xuất CSV, chatbot offline và streaming) + chạy thử bằng trình duyệt tự động + thử chatbot với Gemini thật.
