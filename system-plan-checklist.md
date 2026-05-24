# NetUp System Plan + Checklist (Solo Dev, 2-Week Sprint, FastAPI + Next.js)

## Summary
- Mục tiêu: triển khai full scope đã chốt trong `business.md` trên nền DB hiện tại, theo lộ trình có thể ship được từng phần.
- Output tài liệu: `netup-exe-201/system-plan-checklist.md` (1 file combined theo yêu cầu).
- Quy ước triển khai: `1 dev solo`, sprint `2 tuần`, estimate bằng `story points`.
- Quyết định kiến trúc đã khóa:
1. Backend: `FastAPI (Python)`.
2. Frontend: `Next.js 15`.
3. Admin auth: `Local Admin Only` (không dùng Google cho admin portal).
4. Hidden admin route: `/_internal/netup-admin/*`.

## Implementation Changes (Decision-Complete)

### 1) System Architecture
- Thiết lập 3 service chính trong Docker Compose: `frontend`, `backend-api`, `postgres` (thêm `redis` cho cache/rate-limit/background queue).
- Tách backend theo domain module: `auth`, `admin_auth`, `users_roles`, `owner_requests`, `courts_sessions`, `bookings_payments`, `checkin`, `assessment_elo`, `matches_feedback`, `pool_chat`, `admin_config`, `audit`.
- Chuẩn hóa contract FE-BE bằng OpenAPI + typed client sinh tự động cho Next.js.

### 2) Database Evolution (trên schema hiện tại)
- Giữ nguyên 22 bảng nghiệp vụ đã có.
- Bổ sung local admin auth:
1. `admin_accounts` (`id`, `user_id`, `username`, `password_hash`, `is_active`, `is_super_admin`, `last_login_at`, timestamps).
2. `admin_sessions` (`id`, `admin_account_id`, `refresh_token_hash`, `ip`, `user_agent`, `expires_at`, `revoked_at`).
3. `admin_login_audits` (`id`, `admin_account_id`, `username_attempt`, `success`, `ip`, `user_agent`, `created_at`).
- Admin nghiệp vụ vẫn ghi vết audit vào `audit_logs`; các thao tác admin mapping về `users.id` qua `admin_accounts.user_id`.

### 3) Public APIs / Interfaces
| Domain | Endpoint chính | Mục đích |
|---|---|---|
| Player/Owner Auth | `GET /api/v1/auth/google/start`, `GET /api/v1/auth/google/callback`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | Đăng nhập Google cho player/owner |
| Admin Local Auth | `POST /api/v1/admin/auth/login`, `POST /api/v1/admin/auth/refresh`, `POST /api/v1/admin/auth/logout`, `GET /api/v1/admin/auth/me` | Đăng nhập admin local |
| Owner Request | `POST /api/v1/owner/requests`, `GET /api/v1/owner/requests/me` | Đăng ký owner service |
| Admin Approval | `GET /api/v1/admin/owner-requests`, `POST /api/v1/admin/owner-requests/{id}/approve`, `POST /api/v1/admin/owner-requests/{id}/reject` | Duyệt owner |
| Courts/Sessions | CRUD `court_complexes`, `courts`, `sessions` dưới `/api/v1/owner/*` | Owner vận hành sân |
| Discovery | `GET /api/v1/player/discovery/sessions`, `GET /api/v1/player/sessions/{id}` | List/map/filter session |
| Pool | `POST /api/v1/player/pool-posts`, `GET /api/v1/player/pool-posts`, `POST /api/v1/player/pool-posts/{id}/join` | Tạo/join pool |
| Booking | `POST /api/v1/player/bookings`, `GET /api/v1/player/bookings`, `GET /api/v1/player/bookings/{id}` | Đặt sân |
| Payment | `POST /api/v1/player/bookings/{id}/deposit-payment`, `POST /api/v1/payments/vnpay/webhook` | Cọc online + webhook |
| Check-in | `POST /api/v1/owner/checkins`, `GET /api/v1/owner/checkins` | Check-in + cash settle |
| Assessment/Elo | `POST /api/v1/player/assessments`, `GET /api/v1/player/skill-tier`, `GET /api/v1/player/elo-history` | Onboarding + lịch sử Elo |
| Match/Feedback | `POST /api/v1/player/matches`, `POST /api/v1/player/matches/{id}/feedback`, `POST /api/v1/player/matches/{id}/finalize` | Kết quả trận + feedback + update Elo |
| Pool Chat | `POST /api/v1/player/chat/rooms`, `POST /api/v1/player/chat/rooms/{id}/members`, `GET /api/v1/player/chat/rooms/{id}/messages`, `WS /ws/chat/rooms/{id}` | Group chat pool |
| Admin Config | `GET/PUT /api/v1/admin/config` | Cấu hình hệ thống |

### 4) Frontend Route Plan
- Public: `/`.
- Player: `/player/discovery`, `/player/assessment`, `/player/pool-posts`, `/player/rent-courts`, `/player/session/[id]`, `/player/booking/[sessionId]`, `/player/bookings`, `/player/matches`, `/player/chat/[poolPostId]`.
- Owner: `/owner/dashboard`, `/owner/courts`, `/owner/check-in`.
- Hidden Admin: `/_internal/netup-admin/login`, `/_internal/netup-admin/dashboard`, `/_internal/netup-admin/config`, `/_internal/netup-admin/owner-requests`.
- Middleware FE: chặn route admin nếu thiếu admin session; không render link admin ở nav public.

## Sprint Plan + Detailed Checklist (Story Points)

### Sprint 0 (20 SP) - Foundation
- [x] Chuẩn hóa monorepo structure cho `frontend` + `backend`.
- [x] Dựng FastAPI skeleton + healthcheck + cấu hình env.
- [x] Tích hợp Postgres + migration pipeline + seed tối thiểu.
- [x] Thiết lập CI cơ bản: lint + unit test + migration check.
- [x] Chuẩn hóa logging, error format, request-id.

### Sprint 1 (22 SP) - Auth Core + Admin Local
- [x] Google OAuth flow cho player/owner.
- [x] Session/token strategy cho user app.
- [x] Tạo bảng `admin_accounts`, `admin_sessions`, `admin_login_audits`.
- [x] Xây admin login local + refresh/logout.
- [x] Dựng hidden admin pages login/dashboard shell.
- [x] RBAC middleware cho player/owner/admin contexts.

### Sprint 2 (24 SP) - Owner Onboarding + Court Inventory
- [x] API owner service request.
- [x] API admin approve/reject owner.
- [x] CRUD `court_complexes`, `courts`, `sessions` cho owner.
- [x] Enforce session overlap + duration rule từ DB lên service validation.
- [x] Frontend owner dashboard/courts tích hợp API thật.

### Sprint 3 (24 SP) - Discovery + Booking
- [x] Discovery API list/map/filter (sport, district, time window, slot state).
- [x] Session detail API.
- [x] Booking API cho `solo` và `full_court`.
- [x] Đồng bộ booking state machine ở service.
- [x] Frontend player discovery + booking flow thay mock data.

### Sprint 4 (22 SP) - Payments + Check-in
- [x] Tạo payment plan: deposit bắt buộc, remaining online/cash.
- [x] Tích hợp VNPay tạo giao dịch cọc.
- [x] Webhook idempotent update `payment_transactions` + `bookings`.
- [x] Owner check-in bằng booking code/QR.
- [x] Cash collection khi check-in + ghi nhận payment transaction.
- [x] Frontend booking success + owner check-in màn hình thật.

### Sprint 5 (20 SP) - Assessment + Elo Bootstrap
- [x] Assessment form theo môn thể thao.
- [x] Compute tier + Elo nội bộ ban đầu.
- [x] Không hiển thị Elo raw trên UI, chỉ hiển thị tier.
- [x] Recommendation v1 trong discovery dựa trên tier + distance + slot fit.
- [x] Lưu `elo_rating_history` đầy đủ cho audit.

### Sprint 6 (22 SP) - Match Result + Peer Feedback + Elo Update
- [ ] Tạo match event cho session đã chơi.
- [ ] Nhập participants và kết quả trận.
- [ ] Feedback teammate/opponent theo rule unique.
- [ ] Elo recalculation sau finalize match.
- [ ] Trang player history cho match + feedback + tier change summary.

### Sprint 7 (24 SP) - Pool Group Chat
- [x] Tạo room chat khi có pool post.
- [x] Membership rule: host hoặc người có booking hợp lệ.
- [x] REST load history + WebSocket realtime message.
- [x] System messages (join/leave/close room).
- [x] Auto close room khi session complete/cancelled.
- [x] Frontend chat UI trong luồng pool.

### Sprint 8 (18 SP) - Admin Config + Operations Dashboard
- [ ] Admin config API + UI (deposit %, fee, matching radius...).
- [ ] Dashboard metrics: bookings, payments, check-ins, owner approvals.
- [ ] Audit trail viewer cho thay đổi config/role/action.
- [ ] Hard validation cho config change (range check + audit bắt buộc).

### Sprint 9 (20 SP) - Hardening + UAT + Release
- [ ] Security pass: auth, RBAC, rate limit, brute-force protection admin login.
- [ ] Concurrency test booking để tránh overbook.
- [ ] Load test discovery + booking + chat peak.
- [ ] E2E regression cho 3 role.
- [ ] Backup/restore drill cho Postgres.
- [ ] Production runbook + incident playbook + release checklist.

## Test Plan (Acceptance Scenarios)
- [ ] Player đăng nhập Google, làm assessment, tạo booking, thanh toán cọc, nhận code check-in thành công.
- [ ] Booking cash vẫn bắt buộc cọc online; check-in thu đủ remaining.
- [ ] Owner chưa được admin approve không truy cập owner APIs.
- [ ] Admin local login sai nhiều lần bị rate-limited/lock theo policy.
- [ ] Session overlap bị chặn ở cả API layer và DB layer.
- [ ] Pool chat chỉ cho thành viên hợp lệ gửi tin; user ngoài room bị từ chối.
- [ ] Match feedback đúng teammate/opponent rule; duplicate feedback bị chặn.
- [ ] Elo raw không xuất hiện trên UI người dùng.
- [ ] Webhook VNPay replay không tạo duplicate payment.
- [ ] Dashboard admin phản ánh số liệu chuẩn theo dữ liệu thực.

## Assumptions And Defaults
- Mặc định triển khai web-first, chưa làm mobile native app.
- Scope tạm loại trừ: wallet owner payout, abuse automation, push notification theo khu vực, chatbot rule-based.
- Tổng năng lực 1 dev solo: trung bình 18-24 SP/sprint, tổng roadmap khoảng 9-10 sprint.
- Trong Plan Mode hiện tại chỉ chốt đặc tả; bước thực thi sẽ tạo file `netup-exe-201/system-plan-checklist.md` đúng theo kế hoạch trên.
