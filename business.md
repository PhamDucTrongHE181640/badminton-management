# NetUp Business Requirements (Total Product Scope)

## 1. Product Goal
NetUp la nen tang ket noi nguoi choi the thao va chu san theo mo hinh dat san linh hoat, ghep nhom choi, thanh toan coc, check-in tai san, va van hanh nen tang qua admin.

Muc tieu nghiep vu tong the:
1. Quan ly day du vong doi dat san tu discovery -> booking -> payment -> check-in -> sau tran.
2. Ho tro nhieu vai tro voi quyen khac nhau: Player, Owner, Admin.
3. Dung du lieu nang luc (Elo noi bo) de toi uu goi y san/keo.
4. Dam bao mo rong tot cho cac module van hanh tuong lai.

## 2. Scope tong the

### 2.1 Scope bat buoc trong dac ta hien tai
1. Dang nhap Google cho nguoi dung.
2. Player discovery theo list/map, loc theo mon/khu vuc/khung gio.
3. Hai luong dat san:
   - Keo cho ghep (pool).
   - Thue nguyen san.
4. Form danh gia trinh do ban dau de khoi tao Elo noi bo.
5. Cap nhat Elo sau tran dua tren ket qua tran + feedback.
6. Group chat chi ap dung cho luong pool, theo pool host.
7. Thanh toan co 2 phuong thuc:
   - Online qua VNPay.
   - Tien mat tai san.
8. Du chon tien mat, bat buoc tra coc truoc online.
9. Owner onboarding qua Google + admin gan role owner.
10. Owner van hanh san, check-in booking.
11. Admin cau hinh he thong, dac biet la ti le coc.

### 2.2 Tam bo khoi trien khai gan
1. Vi doi tac + rut tien that cho owner.
2. Report abuse/ban user automation.
3. Push notification theo khu vuc.
4. Chatbot rule-based.

## 3. Role Mapping

| Role | Muc tieu | Quyen chinh | Gioi han |
|---|---|---|---|
| Guest | Kham pha san pham | Xem landing/public content | Khong truy cap du lieu nghiep vu |
| Player | Tim keo, dat san, thi dau | Discovery, booking, payment, feedback, xem lich su ca nhan | Khong quan tri san/he thong |
| Owner Pending | Dang ky dich vu chu san | Gui yeu cau owner | Chua dung owner dashboard |
| Owner Approved | Van hanh san | Quan ly san thuoc quyen, xem lich, check-in booking | Khong sua config he thong |
| Admin | Dieu phoi nen tang | Gan role owner, cau hinh phi/coc/rule, quan tri van hanh | Khong can thiep sai ownership du lieu nguoi dung |

## 4. Use Cases chinh

### 4.1 Player
1. Dang nhap Google va tao ho so.
2. Dien form danh gia ban dau, he thong gan Elo noi bo.
3. Tim session theo filter.
4. Tao pool post (neu du dieu kien).
5. Join pool bang booking solo.
6. Thue nguyen san bang booking full-court.
7. Chon phuong thuc thanh toan:
   - Online toan phan.
   - Coc online + phan con lai tien mat.
8. Nhan booking code/QR de check-in.
9. Sau tran: nhap ket qua tran va gui feedback cho doi thu/dong doi.
10. Xem lich su booking, payment, ket qua tran, lich su feedback.

### 4.2 Group Chat (Pool only)
1. Pool host tao group chat cho pool.
2. Thanh vien da join pool duoc tham gia chat.
3. Host quan ly quyen co ban trong group (moi/loai thanh vien da join pool theo rule he thong).
4. Group chat dong khi pool/session ket thuc theo policy he thong.

### 4.3 Owner
1. Dang nhap Google.
2. Gui yeu cau tro thanh owner.
3. Sau khi admin duyet role: quan ly cum san/san/khung gio.
4. Cau hinh gioi han thoi luong thue cua san.
5. Check-in nguoi choi bang booking code/QR.

### 4.4 Admin
1. Duyet yeu cau owner va gan role.
2. Quan tri config he thong:
   - Platform fee.
   - Floor fee.
   - Deposit percent (ti le coc).
   - Matching radius.
3. Theo doi dashboard van hanh.

## 5. Business Rules

1. Moi hanh dong nghiep vu yeu cau user da dang nhap.
2. Owner chi duoc van hanh sau khi admin gan role owner.
3. Tao pool yeu cau player co danh gia nang luc hop le.
4. Moi session san khong duoc chong lan thoi gian voi session khac cung san.
5. Booking solo chi giu so slot gioi han theo rule he thong.
6. Booking full-court chiem toan bo slot session.
7. Thanh toan tien mat van bat buoc co giao dich coc online truoc.
8. Ti le coc do admin cau hinh, ap dung khi tao booking moi.
9. Trang thai booking va payment phai dong bo theo state machine.
10. Elo la diem noi bo, khong hien thi so Elo truc tiep cho nguoi dung.
11. Elo update dua tren:
    - Ket qua tran (win/loss/draw hoac equivalent).
    - Feedback hau tran tu nguoi tham gia cung match.
12. Moi nguoi dung chi duoc feedback 1 lan cho moi doi tuong trong cung match.
13. Chi nguoi da tham gia match moi duoc gui feedback match do.
14. Group chat pool chi cho nguoi co quan he hop le voi pool.
15. Check-in chi hop le voi booking du dieu kien thanh toan theo policy.

## 6. Elo and Feedback Logic

1. He thong luu Elo numeric noi bo cho matchmaking.
2. UI co the hien thi nhan muc do (tier/level), khong hien thi diem Elo raw.
3. Elo ban dau lay tu form danh gia onboarding.
4. Sau moi tran, he thong nhan:
   - Ket qua tran.
   - Feedback dong doi/doi thu.
5. Elo update chay qua engine chuan hoa de tranh thao tung.
6. Feedback co trong so, co gioi han anh huong theo policy.
7. He thong luu lich su Elo change de audit.

## 7. Payment and Settlement Logic

1. Booking tao ra payment plan gom:
   - Deposit amount (online VNPay, bat buoc).
   - Remaining amount (online hoac cash tai san).
2. Neu player chon cash:
   - Deposit van phai paid online.
   - Phan con lai chuyen trang thai `collect_at_venue`.
3. Check-in co the yeu cau xac nhan da thu phan con lai (cash settlement flag).
4. Payment phai co co che callback/webhook idempotent.

## 8. Non-Functional Requirements

1. Availability: dich vu hoat dong on dinh khung gio cao diem dat san.
2. Performance:
   - Discovery/filter phan hoi nhanh.
   - Matching/recommendation muc tieu duoi nguong thoi gian UX chap nhan duoc.
3. Security:
   - OAuth2 an toan.
   - Bao ve du lieu ca nhan.
   - RBAC chat theo role.
4. Data Integrity:
   - Constraint DB cho slot, booking, payment, feedback uniqueness.
   - Transactional consistency cho booking/payment/check-in.
5. Auditability:
   - Log thay doi config admin.
   - Log role assignment.
   - Log Elo updates.
6. Scalability:
   - Mo hinh du lieu du mo rong cho wallet, report abuse, push notification trong tuong lai.

## 9. Future Backlog Mapping

1. Dynamic Pricing Engine:
   - Rule theo gio cao diem/thap diem, theo ngay va theo san.
2. Owner Wallet and Payout:
   - Vi doi tac, lich su rut tien, trang thai payout.
3. Reconciliation:
   - Bang ke doanh thu tach nhom A/B.
4. Dispute and Report:
   - Quy trinh xu ly tranh chap va bao xau.
5. Campaign and Voucher:
   - Ma giam gia onboarding va loyalty.
6. Notification:
   - Push theo khu vuc va hanh vi nguoi dung.

## 10. Acceptance Criteria for Business Review

1. Tat ca luong Player/Owner/Admin deu co use case tuong ung.
2. Rule ve assessment, slot overlap, pricing, payment, check-in, group chat, feedback-Elo duoc mo ta ro va khong mau thuan.
3. NFR du lam baseline cho thiet ke DB/API.
4. Scope hien tai va backlog tach ro de tranh overbuild.
