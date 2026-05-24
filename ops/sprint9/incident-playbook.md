# NetUp Incident Playbook (Sprint 9)

## Severity
- `SEV-1`: Không thể booking/check-in trên diện rộng.
- `SEV-2`: Lỗi từng module quan trọng (payment webhook, admin config, owner approval).
- `SEV-3`: Lỗi cục bộ có workaround.

## First 15 Minutes
1. Tạo incident channel, chỉ định incident commander.
2. Khoanh vùng ảnh hưởng: player/owner/admin.
3. Kiểm tra health endpoints và error rate logs.
4. Nếu liên quan DB, khóa thay đổi config và dừng deploy mới.

## Diagnostic Checklist
1. API readiness và DB connection pool.
2. Booking conflicts, deadlocks, `booking_conflict` ratio.
3. Payment webhook idempotency and callback latency.
4. Admin login brute-force rate-limited events.

## Mitigation
1. Bật chế độ degrade: chỉ cho read endpoints nếu write lỗi nặng.
2. Rollback service/image nếu lỗi đến từ release mới.
3. Restore DB chỉ khi đã xác nhận data corruption.

## Recovery Validation
1. Health endpoints pass.
2. Thực hiện smoke flow: login -> discovery -> booking -> check-in.
3. Xác nhận audit log ghi nhận đầy đủ các hành động khắc phục.

## Postmortem
1. Hoàn tất trong 48h.
2. Ghi root cause, timeline, action items.
3. Cập nhật runbook và test coverage tương ứng.
