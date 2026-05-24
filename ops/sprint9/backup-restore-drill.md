# Sprint 9 Backup/Restore Drill

## Objective
Xác minh quy trình backup và restore Postgres hoạt động ổn định trước khi release production.

## Command
```bash
bash ops/sprint9/backup_restore_drill.sh
```

## What Script Does
1. Dump database `netup` thành file `.dump`.
2. Tạo database tạm `netup_restore_drill`.
3. Restore dump vào database tạm.
4. Chạy kiểm tra nhanh số lượng bản ghi ở các bảng lõi.
5. Dọn file tạm trong container.

## Evidence To Save
1. File dump trong `ops/sprint9/artifacts/`.
2. Log terminal của lần drill.
3. Ảnh chụp output kiểm tra row count.

## Pass Criteria
1. `pg_restore` kết thúc không lỗi.
2. Các bảng lõi (`users`, `bookings`, `payment_transactions`) đọc được dữ liệu.
3. Ứng dụng vẫn chạy bình thường sau drill.
