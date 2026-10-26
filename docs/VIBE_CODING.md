# Quy trình Vibe Coding

Tài liệu ghi lại cách dự án được xây dựng theo phương pháp "Vibe Coding": sinh viên đóng vai **Product Manager / Reviewer**, AI Agent (Claude Code) viết mã; con người ra yêu cầu, kiểm duyệt, kiểm thử và yêu cầu sửa.

## 1. Các giai đoạn

| # | Giai đoạn | Việc của người | Việc của AI Agent |
|---|---|---|---|
| 1 | Phân tích đề | Cung cấp đề bài, chọn lĩnh vực (cà phê) | Đề xuất stack, mô hình dữ liệu, danh sách API |
| 2 | Backend | Duyệt schema CSDL, quy tắc nghiệp vụ (giá do server tính, luồng trạng thái) | Sinh models, schemas, routers, seed |
| 3 | Kiểm thử backend | Yêu cầu test cho các nghiệp vụ quan trọng | Viết `tests/test_api.py`, chạy & sửa |
| 4 | Frontend | Mô tả giao diện mong muốn (hiện đại, tông màu cà phê, mobile) | Sinh trang, component, store |
| 5 | Kiểm thử E2E | Duyệt ảnh chụp màn hình từng trang | Chạy trình duyệt tự động, chụp màn hình, đọc lỗi console |
| 6 | Tài liệu | Yêu cầu tài liệu phục vụ bảo vệ | Viết README, ARCHITECTURE |

## 2. Mẫu prompt hiệu quả đã dùng

**Prompt khởi tạo (đặt ngữ cảnh):**
> Bạn là chuyên gia full-stack. Xây website bán cà phê với FastAPI + SQLAlchemy + SQLite và React + TypeScript + Tailwind. Yêu cầu: [dán đề bài]. Ràng buộc: giá luôn tính ở server; trừ kho khi đặt, hoàn kho khi hủy; trạng thái đơn chỉ đi pending → shipping → completed hoặc cancelled.

**Prompt theo từng phần nhỏ (quản lý context):**
> Viết router `orders.py`: tạo đơn trong 1 transaction, kiểm tra tồn kho, áp mã giảm giá, thanh toán thẻ giả lập kiểm tra Luhn; thẻ 4000 0000 0000 0002 luôn bị từ chối.

**Prompt kiểm thử:**
> Viết pytest dùng SQLite in-memory, kiểm tra: tính tiền + coupon + phí ship, không bán vượt tồn kho, user thường gọi API admin bị 403, admin không thể chuyển pending → completed.

**Prompt sửa lỗi (đưa đúng bằng chứng):**
> Trang chủ trắng. Console: "destroy is not a function", API /api/categories trả 500 với traceback: [dán]. Tìm nguyên nhân gốc và sửa, thêm test để lỗi không tái diễn.

## 3. Lỗi phát hiện khi kiểm duyệt code AI (và cách sửa)

Đây là minh chứng rằng code AI **cần được review và test**, không chấp nhận mù quáng:

| Lỗi | Phát hiện bằng | Nguyên nhân | Sửa |
|---|---|---|---|
| `GET /api/categories` trả 500 | Chụp màn hình thấy trang trắng → đọc log backend | Truyền `product_count` hai lần khi dựng `CategoryWithCount` | Validate bằng `CategoryOut` rồi mới thêm `product_count`; thêm test `test_categories_with_product_count` |
| Cả app trắng trang | Đọc console trình duyệt | `useEffect(() => window.scrollTo(0,0))` trả về giá trị thay vì hàm cleanup | Bọc trong `{ }`; thêm `ErrorBoundary` để lỗi 1 component không làm sập cả trang |
| Biểu đồ doanh thu bị nén vào 1/5 chiều ngang | So sánh ảnh chụp với dữ liệu API | Animation của Recharts 2 lỗi khi chạy với React 19 | `isAnimationActive={false}` |
| Chatbot offline trả sản phẩm khi khách chỉ nói "xin chào" | Đọc lại logic chấm điểm | Điểm thưởng rating khiến mọi sản phẩm đều > 0 | Tách điểm khớp từ khóa và điểm thưởng; câu chào → hỏi lại nhu cầu |
| Test đăng ký trùng email trả 422 thay vì 409 | pytest | Dữ liệu test (`full_name="X"`) vi phạm `min_length=2` | Sửa dữ liệu test – API đúng |

### Vòng 2 – "Nhìn dưới góc độ chuyên gia, còn thiếu gì?"

| Lỗi / điểm yếu | Phát hiện bằng | Nguyên nhân | Sửa |
|---|---|---|---|
| Ảnh sản phẩm sai nội dung (máy xay hiện ảnh bánh donut, V60 hiện ảnh cuốn sổ) | Dựng bảng xem trước toàn bộ ảnh rồi xem bằng mắt | Lúc seed chỉ kiểm tra link còn sống (HTTP 200), không kiểm tra nội dung | Thay ảnh đúng; sản phẩm không tìm được ảnh thì đổi sản phẩm cho khớp ảnh |
| Ai cũng đánh giá được sản phẩm | Tự review logic nghiệp vụ | Chỉ gắn nhãn "Đã mua hàng" chứ không chặn | 403 nếu chưa có đơn hoàn thành; thêm test |
| Thanh toán QR được coi là đã trả tiền ngay khi đặt | Tự review luồng thanh toán | Mã giả lập quá đơn giản | Đơn QR ở trạng thái chờ thanh toán, phải xác nhận; admin không giao đơn chưa trả tiền |
| `gemini-3.8-flash` mất khoảng 60 giây mỗi câu | Đo thời gian 5 model bằng script | Model "thinking" nặng | Chuyển sang `gemini-3.5-flash-lite` (khoảng 3 giây, gọi hàm chính xác) |
| Chatbot offline đọc "5 gói" thành "5g" | pytest `test_chat_add_to_cart_by_voice_is_validated` | Regex `(?!\s*g)` thiếu ranh giới từ nên chặn nhầm chữ "gói" | `(?!\s*(g\|kg\|k\|ml)\b)` |
| Endpoint mới trả 404 dù code đúng | Gọi thử API, đối chiếu log | Tiến trình uvicorn cũ (mồ côi sau `--reload` trên Windows) vẫn giữ cổng 8000 và phục vụ code cũ | Tìm PID đang giữ cổng, dừng tiến trình đó, khởi động lại |
| Dòng "Mua thêm … để freeship" bị chia thành 3 cột | Ảnh chụp màn hình | Các mẩu chữ nằm trực tiếp trong flex container nên mỗi mẩu thành một cột | Bọc chữ trong `<span>` |
| Ảnh chụp "chế độ sáng" lại ra tối | Ảnh chụp màn hình | Theme mặc định theo hệ điều hành (máy đang để tối), hành vi đúng | Ép theme khi chụp để kiểm tra cả hai chế độ |

### Vòng 3 – "Giao diện hơi chán + đồ uống thiếu tùy chọn đá/đường/topping"

| Lỗi / điểm yếu | Phát hiện bằng | Nguyên nhân | Sửa |
|---|---|---|---|
| Danh mục "pha sẵn" chỉ có đồ đóng chai, không chọn được đá/đường | Phản hồi người dùng | Thiếu mô hình đồ uống pha chế | Thêm `toppings`, cờ `is_drink`/`allow_toppings`, `options_json`; một hàm kiểm tra dùng chung |
| Chatbot offline đọc "50% đường" thành mặc định 100% | pytest | Hàm bỏ dấu tiếng Việt cũng xóa ký tự `%` | Đọc `%` từ câu gốc, hỗ trợ thêm "50 đường" |
| Khách xin 4 shot espresso, server âm thầm giảm còn 3 | Thử Gemini thật | Kiểm tra đúng nhưng không thông báo | Chatbot nói rõ đã giới hạn 3 phần/loại |
| Trang đồ uống tràn ngang trên điện thoại | Chụp màn hình 390px + đo `scrollWidth` | Phần tử con của CSS grid mặc định `min-width: auto` | `min-w-0` cho cột và nút mức đá |

### Vòng 4 – "Làm trang chủ động giống ảnh mẫu"

| Lỗi | Phát hiện bằng | Nguyên nhân | Sửa |
|---|---|---|---|
| Chữ "CÀ PHÊ" hiện thành "CA PHE" | Ảnh chụp màn hình | `background-clip:text` chỉ tô trong hộp phần tử; `line-height: .85` khiến dấu nằm ngoài hộp → trong suốt | Nới `padding-top` (bù `margin-top` âm) cho từng ký tự |
| Hero không tự chuyển cảnh trên điện thoại (dự đoán trước) | Đọc lại code | Thẻ có thanh tiến trình bị `display:none` trên mobile → animation không chạy → không có `animationend` | Chấm chỉ báo mobile có thanh tiến trình riêng |
| Logo xuống 2 dòng trên mobile, nhãn "Nổi bật" bị kéo dài | Ảnh chụp 390px / trang cửa hàng | Thiếu `whitespace-nowrap`; flex dọc mặc định `align-items: stretch` | `whitespace-nowrap`, `items-start` |

### Vòng 5 – "Thêm hiệu ứng, video, tách trang chủ/cửa hàng, thêm 30 sản phẩm"

| Vấn đề | Phát hiện bằng | Nguyên nhân | Xử lý |
|---|---|---|---|
| Unsplash/Pexels chặn tìm ảnh tự động | Gọi thử | Cần API key | Dùng Openverse (CC0), dựng bảng xem trước để chọn ảnh bằng mắt |
| Link ảnh rawpixel có chữ ký hết hạn | Đọc URL | Signed URL | Tải về, thu nhỏ 900px, lưu trong `backend/static` |
| Wikimedia/StockSnap trả 403 | Script tải ảnh | Chính sách User-Agent khác nhau | UA mô tả dự án cho Wikimedia, UA trình duyệt cho StockSnap |
| Ảnh in thương hiệu thật (chai cold brew, máy xay STRAUME) | Xem bảng ảnh | — | Thay ảnh không thương hiệu |
| Tiêu đề tách chữ bị dính liền | Ảnh chụp | Dấu cách ở cuối `inline-block` bị bỏ | Đưa dấu cách ra ngoài phần tử |
| Lưới danh mục trống 1 ô | Ảnh chụp | 7 thẻ trong lưới 4 cột | 2 thẻ cuối chiếm 2 cột |

### Vòng 6 – "Áp dụng phong cách Active Theory / Dogstudio / Aristide Benoist"

Quyết định: lấy **Dogstudio** làm xương sống (vật thể 3D + kể chuyện theo cuộn), thêm **Aristide Benoist** (chữ tạp chí, cuộn mượt, ảnh gợn nước), chỉ mượn **hạt sáng** của Active Theory; chỉ áp dụng ở trang giới thiệu để trang mua hàng vẫn nhanh.

| Vấn đề | Phát hiện bằng | Nguyên nhân | Sửa |
|---|---|---|---|
| Chữ chương 2–3 nằm giữa đè lên tách trắng | Ảnh chụp | Bố cục giữa | Tách & chữ đổi bên mỗi chương + lớp tối phía có chữ |
| Hiệu ứng đổ hạt trễ so với vị trí cuộn | Ảnh chụp trên máy chậm | Nội suy theo khung hình | Nội suy theo thời gian `1 - e^(-dt·k)` |
| HeroSlider bị lệch khi không còn ở đầu trang | Ảnh chụp | Parallax dùng `scrollY` của cả trang | Dùng quãng đã cuộn qua chính phần tử |
| Lỗi TS1294 | `tsc` | `erasableSyntaxOnly` cấm `constructor(private x)` | Khai báo thuộc tính tường minh |
| Chữ khó đọc trên mobile | Ảnh chụp 390px | Tách nằm sau chữ | Mobile đưa tách lên nửa trên |

## 4. Lịch sử Git
Mỗi giai đoạn là một commit riêng (`git log --oneline`): MVP → sửa ảnh → sửa quy tắc nghiệp vụ → biến thể + wishlist → nâng cấp chatbot → admin/UX → tài liệu. Thông điệp commit ghi rõ *làm gì và vì sao*, có thể dùng khi trình bày quy trình.

## 5. Bài học
- **Chia nhỏ yêu cầu**: mỗi lần một module (models → router → test → UI) giúp AI giữ đúng ngữ cảnh.
- **Ràng buộc nghiệp vụ phải nói rõ** (giá do server tính, luồng trạng thái) – AI không tự đoán được ý đồ kinh doanh.
- **Luôn chạy thật**: build TypeScript thành công ≠ app chạy đúng. 2/5 lỗi trên chỉ lộ ra khi mở trình duyệt.
- **Đưa bằng chứng khi báo lỗi** (log, traceback, ảnh chụp) thay vì mô tả chung chung.
- **Đo trước khi chọn**: model AI "mới nhất" chưa chắc phù hợp; đo độ trễ thực tế rồi mới quyết định.
- **Kiểm tra cả nội dung chứ không chỉ "chạy được"**: link ảnh trả 200 nhưng ảnh vẫn có thể sai.
- **Không tin tuyệt đối vào AI ngay trong sản phẩm**: hành động do LLM đề xuất (thêm vào giỏ) luôn được server kiểm tra lại.
