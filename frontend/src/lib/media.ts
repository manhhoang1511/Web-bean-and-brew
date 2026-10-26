/**
 * Ảnh & video minh họa được tải sẵn về backend/static/media (xem docs/CREDITS.md)
 * -> web chạy được hoàn toàn khi KHÔNG có mạng (demo tại lớp, wifi yếu).
 */
export const photo = (id: string) => `/static/media/u/${id}.jpg`
export const video = (file: string) => `/static/media/video/${file}`
