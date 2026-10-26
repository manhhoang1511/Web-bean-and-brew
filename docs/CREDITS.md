# Nguồn hình ảnh & video

## Video (Wikimedia Commons)
| Video | Tác giả | Giấy phép | Dùng ở |
|---|---|---|---|
| [Morning Espresso Routine (abridged version)](https://commons.wikimedia.org/wiki/File:Morning_Espresso_Routine_(abridged_version).webm) | Scott Schiller | CC BY 2.0 | Trang chủ – video giới thiệu |
| [Ripen coffee fruits, Kodagu, Karnataka](https://commons.wikimedia.org/wiki/File:Ripen_coffee_fruits,_Kodagu,_Karnataka.webm) | Subhashish Panigrahi | CC BY-SA 3.0 | Hành trình – Trồng |
| [Color sorter coffeebeans](https://commons.wikimedia.org/wiki/File:Color_sorter_coffeebeans.webm) | AlexanderKlink | CC0 | Hành trình – Thu hái |
| [Milk crown HighSpeedPhoto](https://commons.wikimedia.org/wiki/File:Milk_crown_HighSpeedPhoto.webm) | Phonon.b | CC BY-SA 4.0 | Hành trình – Pha chế |

Video được **tải về** `backend/static/media/video/` (bản chuyển mã của Wikimedia, không sửa nội dung) để web chạy được khi không có mạng; tên tác giả và giấy phép hiển thị ngay trên giao diện.

## Ảnh sản phẩm
- **30 sản phẩm bổ sung** (`backend/static/products/*.jpg`): ảnh giấy phép **CC0** tìm qua [Openverse](https://openverse.org) từ StockSnap, rawpixel và Wikimedia Commons; đã thu nhỏ còn 900px. Đã loại các ảnh có in thương hiệu thật trên bao bì.
- **Các sản phẩm ban đầu, banner, hero**: ảnh từ [Unsplash](https://unsplash.com) theo [Unsplash License](https://unsplash.com/license) (dùng miễn phí, không bắt buộc ghi công); đã tải về `backend/static/media/u/<mã ảnh>.jpg` (tối đa 1600px).

## Phông chữ
- **Be Vietnam Pro** và **Playfair Display** (SIL Open Font License) – đóng gói qua `@fontsource`, không tải từ Google Fonts.
