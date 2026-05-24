# Fix lỗi Next.js `Cannot find module './979.js'` trong Docker

## Triệu chứng
Khi mở trang frontend trong container `frontend`, log báo:

```txt
Error: Cannot find module './979.js'
Require stack:
- /app/.next/server/webpack-runtime.js
- /app/.next/server/pages/_document.js
```

## Tại sao bị lỗi
Lỗi này thường do **cache build `.next` bị stale/corrupt** trong môi trường dev Docker:
1. `.next` được giữ qua nhiều vòng chạy (persistent volume hoặc cache cũ).
2. Sau khi đổi cấu trúc file/page, Next dev server vẫn tham chiếu chunk cũ.
3. Chunk cũ (ví dụ `979.js`) không còn tồn tại nhưng runtime vẫn require.

## Fix dứt điểm (đã áp dụng vào `docker-compose.yml`)
1. **Không mount volume riêng cho `/app/.next`** nữa.
2. Mỗi lần start frontend sẽ **xóa toàn bộ `.next`** trước khi chạy dev server.

Phần đã sửa:
- Bỏ mount `frontend-next:/app/.next`.
- Đổi lệnh từ `rm -rf /app/.next/*` thành `rm -rf /app/.next`.

## Cách xử lý ngay trên máy của bạn
Chạy theo thứ tự sau:

```bash
cd /kientt/netup/netup-exe-201

# Dừng frontend hiện tại
docker compose stop frontend

# Gỡ volume cache .next cũ (nếu còn từ cấu hình cũ)
docker volume rm netup-exe-201_frontend-next 2>/dev/null || true

# Khởi động lại frontend với compose đã sửa
docker compose up -d frontend

# Theo dõi log xác nhận không còn lỗi

docker compose logs -f frontend
```

## Nếu vẫn còn lỗi
1. Rebuild frontend service:

```bash
docker compose up -d --build frontend
```

2. Xóa cache cứng trong container rồi khởi động lại:

```bash
docker compose exec -T frontend sh -lc 'rm -rf /app/.next /app/node_modules/.cache || true'
docker compose restart frontend
```

## Cách phòng tránh
1. Tránh giữ persistent volume cho `.next` trong dev Docker.
2. Khi thay đổi cấu trúc route/layout lớn, restart frontend container sau khi clear `.next`.
3. Giữ version `next` đồng nhất giữa `package.json`, lockfile và container install.
