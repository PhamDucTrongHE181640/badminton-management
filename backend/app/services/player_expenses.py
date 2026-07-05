from __future__ import annotations

from datetime import datetime, date
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.db.session import get_engine

ELIGIBLE_BOOKING_STATUSES = {"deposit_paid", "confirmed", "checked_in", "completed"}


def _expense_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "session_id": str(row.session_id) if row.session_id else None,
        "title": str(row.title),
        "expense_date": row.expense_date.isoformat() if isinstance(row.expense_date, (date, datetime)) else str(row.expense_date),
        "created_by_user_id": str(row.created_by_user_id) if row.created_by_user_id else None,
        "total_amount_vnd": int(row.total_amount_vnd),
        "split_amount_vnd": int(row.split_amount_vnd),
        "notes": str(row.notes) if row.notes else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _participant_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "expense_id": str(row.expense_id),
        "user_id": str(row.user_id) if row.user_id else None,
        "display_name": str(row.display_name),
        "is_guest": bool(row.is_guest),
        "amount_paid_vnd": int(row.amount_paid_vnd),
        "amount_owed_vnd": int(row.amount_owed_vnd),
        "balance_vnd": int(row.balance_vnd),
    }


def _item_row_to_dict(row: Any) -> dict[str, Any]:
    split_parts = []
    if hasattr(row, "split_participants") and row.split_participants:
        split_parts = [name.strip() for name in row.split_participants.split(",") if name.strip()]
    return {
        "id": str(row.id),
        "expense_id": str(row.expense_id),
        "name": str(row.name),
        "amount_vnd": int(row.amount_vnd),
        "paid_by_participant_id": str(row.paid_by_participant_id),
        "split_between_display_names": split_parts if split_parts else None
    }


def _payment_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "expense_id": str(row.expense_id),
        "sender_participant_id": str(row.sender_participant_id),
        "sender_name": str(row.sender_name) if hasattr(row, "sender_name") else None,
        "receiver_participant_id": str(row.receiver_participant_id),
        "receiver_name": str(row.receiver_name) if hasattr(row, "receiver_name") else None,
        "receiver_user_id": str(row.receiver_user_id) if hasattr(row, "receiver_user_id") and row.receiver_user_id else None,
        "amount_vnd": int(row.amount_vnd),
        "status": str(row.status),
        "settled_at": row.settled_at,
        "created_at": row.created_at,
    }


def get_expense_detail_by_id(*, expense_id: str, actor_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        expense_row = connection.execute(
            text("SELECT * FROM public.session_expenses WHERE id = :expense_id LIMIT 1"),
            {"expense_id": expense_id}
        ).first()

        if not expense_row:
            raise AppError(
                status_code=404,
                code="expense_not_found",
                message="Không tìm thấy hóa đơn chia tiền",
            )

        participants_rows = connection.execute(
            text("SELECT * FROM public.session_expense_participants WHERE expense_id = :expense_id"),
            {"expense_id": expense_id}
        ).all()

        items_rows = connection.execute(
            text("SELECT * FROM public.session_expense_items WHERE expense_id = :expense_id"),
            {"expense_id": expense_id}
        ).all()

        payments_rows = connection.execute(
            text(
                """
                SELECT p.*, 
                       sp.display_name as sender_name, 
                       rp.display_name as receiver_name,
                       rp.user_id as receiver_user_id
                FROM public.session_expense_payments p
                JOIN public.session_expense_participants sp ON sp.id = p.sender_participant_id
                JOIN public.session_expense_participants rp ON rp.id = p.receiver_participant_id
                WHERE p.expense_id = :expense_id
                """
            ),
            {"expense_id": expense_id}
        ).all()

        participants = [_participant_row_to_dict(p) for p in participants_rows]
        items = [_item_row_to_dict(i) for i in items_rows]
        payments = [_payment_row_to_dict(p) for p in payments_rows]

        num_participants = len(participants)
        breakdown = []
        if num_participants > 0:
            for item in items:
                breakdown.append({
                    "item_name": item["name"],
                    "share_amount": item["amount_vnd"] // num_participants,
                    "reason": f"Chia đều từ {item['amount_vnd']:,}đ cho {num_participants} người"
                })

        return {
            "exists": True,
            "expense": _expense_row_to_dict(expense_row),
            "participants": participants,
            "items": items,
            "payments": payments,
            "breakdown": breakdown
        }


def get_or_init_session_expenses(*, session_id: str, actor_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        session_row = connection.execute(
            text("SELECT id, title, starts_at::date as start_date FROM public.sessions WHERE id = :session_id LIMIT 1"),
            {"session_id": session_id}
        ).first()

        if not session_row:
            raise AppError(
                status_code=404,
                code="session_not_found",
                message="Không tìm thấy thông tin buổi chơi",
            )

        expense_row = connection.execute(
            text("SELECT id FROM public.session_expenses WHERE session_id = :session_id LIMIT 1"),
            {"session_id": session_id}
        ).first()

        if expense_row:
            return get_expense_detail_by_id(expense_id=str(expense_row.id), actor_user_id=actor_user_id)

        # Khởi tạo mặc định
        booking_rows = connection.execute(
            text(
                """
                SELECT DISTINCT b.player_user_id, u.full_name
                FROM public.bookings b
                JOIN public.users u ON u.id = b.player_user_id
                WHERE b.session_id = :session_id
                  AND b.status IN ('deposit_paid', 'confirmed', 'checked_in', 'completed')
                """
            ),
            {"session_id": session_id}
        ).all()

        court_price_row = connection.execute(
            text(
                """
                SELECT SUM(total_price_vnd) as total_price
                FROM public.bookings
                WHERE session_id = :session_id
                  AND status IN ('deposit_paid', 'confirmed', 'checked_in', 'completed')
                """
            ),
            {"session_id": session_id}
        ).first()

        court_price = int(court_price_row.total_price or 0) if court_price_row else 0

        participants = []
        for row in booking_rows:
            participants.append({
                "id": str(uuid4()),
                "user_id": str(row.player_user_id),
                "display_name": str(row.full_name),
                "is_guest": False,
                "amount_paid_vnd": 0,
                "amount_owed_vnd": 0,
                "balance_vnd": 0
            })

        host_participant_id = None
        if participants:
            actor_in_list = [p for p in participants if p["user_id"] == actor_user_id]
            if actor_in_list:
                host_participant_id = actor_in_list[0]["id"]
                actor_in_list[0]["amount_paid_vnd"] = court_price
            else:
                host_participant_id = participants[0]["id"]
                participants[0]["amount_paid_vnd"] = court_price

        items = []
        if court_price > 0 and host_participant_id:
            items.append({
                "id": str(uuid4()),
                "name": "Tiền sân",
                "amount_vnd": court_price,
                "paid_by_participant_id": host_participant_id
            })

        num_participants = len(participants)
        split_amount = court_price // num_participants if num_participants > 0 else 0
        for p in participants:
            p["amount_owed_vnd"] = split_amount
            p["balance_vnd"] = p["amount_paid_vnd"] - p["amount_owed_vnd"]

        payments = []
        if num_participants > 1:
            debtors = [dict(p) for p in participants if p["balance_vnd"] < 0]
            creditors = [dict(p) for p in participants if p["balance_vnd"] > 0]
            debtors.sort(key=lambda x: x["balance_vnd"])
            creditors.sort(key=lambda x: x["balance_vnd"], reverse=True)

            i, j = 0, 0
            while i < len(debtors) and j < len(creditors):
                deb = debtors[i]
                cred = creditors[j]
                settle_amount = min(-deb["balance_vnd"], cred["balance_vnd"])
                if settle_amount > 0:
                    payments.append({
                        "id": str(uuid4()),
                        "sender_participant_id": deb["id"],
                        "sender_name": deb["display_name"],
                        "receiver_participant_id": cred["id"],
                        "receiver_name": cred["display_name"],
                        "receiver_user_id": cred["user_id"],
                        "amount_vnd": settle_amount,
                        "status": "pending",
                        "settled_at": None,
                        "created_at": None
                    })
                deb["balance_vnd"] += settle_amount
                cred["balance_vnd"] -= settle_amount
                if deb["balance_vnd"] == 0:
                    i += 1
                if cred["balance_vnd"] == 0:
                    j += 1

        breakdown = []
        if num_participants > 0 and court_price > 0:
            breakdown.append({
                "item_name": "Tiền sân",
                "share_amount": split_amount,
                "reason": f"Chia đều từ {court_price:,}đ cho {num_participants} người"
            })

        expense = {
            "id": None,
            "session_id": session_id,
            "title": f"Chia tiền: {session_row.title}",
            "expense_date": session_row.start_date.isoformat() if isinstance(session_row.start_date, (date, datetime)) else str(session_row.start_date),
            "created_by_user_id": actor_user_id,
            "total_amount_vnd": court_price,
            "split_amount_vnd": split_amount,
            "notes": ""
        }

        return {
            "exists": False,
            "expense": expense,
            "participants": participants,
            "items": items,
            "payments": payments,
            "breakdown": breakdown
        }


def create_or_update_expense(
    *,
    expense_id: str | None = None,
    session_id: str | None = None,
    created_by_user_id: str,
    data: dict[str, Any]
) -> dict[str, Any]:
    title = str(data.get("title") or "").strip()
    expense_date_str = str(data.get("expense_date") or "").strip()
    notes = str(data.get("notes") or "").strip() or None
    participants_input = data.get("participants") or []
    items_input = data.get("items") or []

    if not title:
        raise AppError(status_code=422, code="expense_title_required", message="Vui lòng nhập tiêu đề ghi chú")
    if not expense_date_str:
        raise AppError(status_code=422, code="expense_date_required", message="Vui lòng chọn ngày")
    if not participants_input:
        raise AppError(status_code=422, code="expense_participants_required", message="Phải có ít nhất 1 người tham gia")

    try:
        expense_date = datetime.strptime(expense_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise AppError(status_code=422, code="expense_date_invalid", message="Định dạng ngày không hợp lệ (YYYY-MM-DD)")

    with get_engine().begin() as connection:
        if session_id:
            session_row = connection.execute(
                text("SELECT id FROM public.sessions WHERE id = :session_id LIMIT 1"),
                {"session_id": session_id}
            ).first()
            if not session_row:
                raise AppError(status_code=404, code="session_not_found", message="Không tìm thấy buổi chơi")

        target_expense_id = None
        if expense_id:
            existing = connection.execute(
                text("SELECT id FROM public.session_expenses WHERE id = :expense_id LIMIT 1"),
                {"expense_id": expense_id}
            ).first()
            if existing:
                target_expense_id = existing.id
        elif session_id:
            existing = connection.execute(
                text("SELECT id FROM public.session_expenses WHERE session_id = :session_id LIMIT 1"),
                {"session_id": session_id}
            ).first()
            if existing:
                target_expense_id = existing.id

        if target_expense_id:
            connection.execute(
                text(
                    """
                    UPDATE public.session_expenses
                    SET title = :title,
                        expense_date = :expense_date,
                        notes = :notes,
                        updated_at = now()
                    WHERE id = :expense_id
                    """
                ),
                {
                    "expense_id": target_expense_id,
                    "title": title,
                    "expense_date": expense_date,
                    "notes": notes,
                }
            )
            connection.execute(
                text("DELETE FROM public.session_expense_participants WHERE expense_id = :expense_id"),
                {"expense_id": target_expense_id}
            )
        else:
            target_expense_id = uuid4()
            connection.execute(
                text(
                    """
                    INSERT INTO public.session_expenses (
                      id, session_id, title, expense_date, created_by_user_id, notes
                    )
                    VALUES (:id, :session_id, :title, :expense_date, :created_by_user_id, :notes)
                    """
                ),
                {
                    "id": target_expense_id,
                    "session_id": session_id,
                    "title": title,
                    "expense_date": expense_date,
                    "created_by_user_id": created_by_user_id,
                    "notes": notes
                }
            )

        participant_map = {}
        for p in participants_input:
            p_id = uuid4()
            display_name = str(p.get("display_name") or "").strip()
            user_id = p.get("user_id") or None
            is_guest = bool(p.get("is_guest", False))
            
            if not display_name:
                raise AppError(status_code=422, code="participant_name_required", message="Tên người tham gia không được để trống")

            participant_map[display_name] = p_id
            
            connection.execute(
                text(
                    """
                    INSERT INTO public.session_expense_participants (
                      id, expense_id, user_id, display_name, is_guest, amount_paid_vnd, amount_owed_vnd, balance_vnd
                    )
                    VALUES (:id, :expense_id, :user_id, :display_name, :is_guest, 0, 0, 0)
                    """
                ),
                {
                    "id": p_id,
                    "expense_id": target_expense_id,
                    "user_id": user_id,
                    "display_name": display_name,
                    "is_guest": is_guest
                }
            )

        total_amount = 0
        participant_paid_sums = {p_id: 0 for p_id in participant_map.values()}
        participant_owed_sums = {p_id: 0 for p_id in participant_map.values()}

        for item in items_input:
            item_name = str(item.get("name") or "").strip()
            amount = int(item.get("amount_vnd") or 0)
            paid_by_display_name = str(item.get("paid_by_display_name") or "").strip()
            split_between = item.get("split_between_display_names")

            if not item_name:
                raise AppError(status_code=422, code="item_name_required", message="Tên khoản chi không được để trống")
            if amount <= 0:
                raise AppError(status_code=422, code="item_amount_invalid", message="Số tiền chi phải lớn hơn 0")
            if paid_by_display_name not in participant_map:
                raise AppError(
                    status_code=422,
                    code="item_paid_by_invalid",
                    message=f"Người trả tiền '{paid_by_display_name}' không tồn tại trong danh sách người chơi"
                )

            paid_by_id = participant_map[paid_by_display_name]
            participant_paid_sums[paid_by_id] += amount
            total_amount += amount

            # Tính phần nợ
            target_p_ids = []
            if isinstance(split_between, list) and len(split_between) > 0:
                for name in split_between:
                    name_str = str(name).strip()
                    if name_str in participant_map:
                        target_p_ids.append(participant_map[name_str])
            
            if len(target_p_ids) == 0:
                target_p_ids = list(participant_map.values())
            
            item_share = amount // len(target_p_ids)
            for p_id in target_p_ids:
                participant_owed_sums[p_id] += item_share

            split_participants_str = None
            if isinstance(split_between, list) and len(split_between) > 0:
                split_participants_str = ",".join([str(name).strip() for name in split_between if str(name).strip()])

            connection.execute(
                text(
                    """
                    INSERT INTO public.session_expense_items (
                      id, expense_id, name, amount_vnd, paid_by_participant_id, split_participants
                    )
                    VALUES (:id, :expense_id, :name, :amount_vnd, :paid_by_participant_id, :split_participants)
                    """
                ),
                {
                    "id": uuid4(),
                    "expense_id": target_expense_id,
                    "name": item_name,
                    "amount_vnd": amount,
                    "paid_by_participant_id": paid_by_id,
                    "split_participants": split_participants_str
                }
            )

        num_participants = len(participant_map)
        split_amount = total_amount // num_participants if num_participants > 0 else 0

        participants_state = []
        for name, p_id in participant_map.items():
            paid_amount = participant_paid_sums[p_id]
            owed_amount = participant_owed_sums[p_id]
            balance = paid_amount - owed_amount

            connection.execute(
                text(
                    """
                    UPDATE public.session_expense_participants
                    SET amount_paid_vnd = :paid_amount,
                         amount_owed_vnd = :owed_amount,
                         balance_vnd = :balance
                    WHERE id = :p_id
                    """
                ),
                {
                    "p_id": p_id,
                    "paid_amount": paid_amount,
                    "owed_amount": owed_amount,
                    "balance": balance
                }
            )

            user_id = next((p.get("user_id") for p in participants_input if p.get("display_name") == name), None)
            participants_state.append({
                "id": p_id,
                "display_name": name,
                "user_id": user_id,
                "balance_vnd": balance
            })

        connection.execute(
            text(
                """
                UPDATE public.session_expenses
                SET total_amount_vnd = :total_amount,
                    split_amount_vnd = :split_amount
                WHERE id = :expense_id
                """
            ),
            {"expense_id": target_expense_id, "total_amount": total_amount, "split_amount": split_amount}
        )

        debtors = [p for p in participants_state if p["balance_vnd"] < 0]
        creditors = [p for p in participants_state if p["balance_vnd"] > 0]
        debtors.sort(key=lambda x: x["balance_vnd"])
        creditors.sort(key=lambda x: x["balance_vnd"], reverse=True)

        i, j = 0, 0
        while i < len(debtors) and j < len(creditors):
            deb = debtors[i]
            cred = creditors[j]
            settle_amount = min(-deb["balance_vnd"], cred["balance_vnd"])

            if settle_amount > 0:
                connection.execute(
                    text(
                        """
                        INSERT INTO public.session_expense_payments (
                          id, expense_id, sender_participant_id, receiver_participant_id, amount_vnd, status
                        )
                        VALUES (:id, :expense_id, :sender_participant_id, :receiver_participant_id, :amount_vnd, 'pending')
                        """
                    ),
                    {
                        "id": uuid4(),
                        "expense_id": target_expense_id,
                        "sender_participant_id": deb["id"],
                        "receiver_participant_id": cred["id"],
                        "amount_vnd": settle_amount
                    }
                )

            deb["balance_vnd"] += settle_amount
            cred["balance_vnd"] -= settle_amount

            if deb["balance_vnd"] == 0:
                i += 1
            if cred["balance_vnd"] == 0:
                j += 1

    return get_expense_detail_by_id(expense_id=str(target_expense_id), actor_user_id=created_by_user_id)


def toggle_payment_status(*, payment_id: str, status: str, actor_user_id: str) -> dict[str, Any]:
    if status not in {"pending", "settled"}:
        raise AppError(status_code=422, code="invalid_payment_status", message="Trạng thái thanh toán không hợp lệ")

    with get_engine().begin() as connection:
        payment_row = connection.execute(
            text(
                """
                SELECT p.*, e.created_by_user_id, rp.user_id as receiver_user_id
                FROM public.session_expense_payments p
                JOIN public.session_expenses e ON e.id = p.expense_id
                JOIN public.session_expense_participants rp ON rp.id = p.receiver_participant_id
                WHERE p.id = :payment_id
                LIMIT 1
                """
            ),
            {"payment_id": payment_id}
        ).first()

        if not payment_row:
            raise AppError(status_code=404, code="payment_not_found", message="Không tìm thấy giao dịch thanh toán")

        is_creator = str(payment_row.created_by_user_id) == actor_user_id
        is_receiver = payment_row.receiver_user_id and str(payment_row.receiver_user_id) == actor_user_id

        if not (is_creator or is_receiver):
            raise AppError(
                status_code=403,
                code="permission_denied",
                message="Chỉ chủ nợ hoặc người tạo hóa đơn mới được thay đổi trạng thái giao dịch này"
            )

        settled_at = datetime.now() if status == "settled" else None
        connection.execute(
            text(
                """
                UPDATE public.session_expense_payments
                SET status = :status,
                    settled_at = :settled_at
                WHERE id = :payment_id
                """
            ),
            {"payment_id": payment_id, "status": status, "settled_at": settled_at}
        )
        expense_id = str(payment_row.expense_id)

    return get_expense_detail_by_id(expense_id=expense_id, actor_user_id=actor_user_id)


def get_my_expenses_history(*, user_id: str) -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT DISTINCT e.*, 
                       p.amount_paid_vnd, 
                       p.amount_owed_vnd, 
                       p.balance_vnd,
                       s.title as session_title,
                       c.name as complex_name
                FROM public.session_expenses e
                JOIN public.session_expense_participants p ON p.expense_id = e.id
                LEFT JOIN public.sessions s ON s.id = e.session_id
                LEFT JOIN public.courts cr ON cr.id = s.court_id
                LEFT JOIN public.court_complexes c ON c.id = cr.complex_id
                WHERE p.user_id = :user_id
                ORDER BY e.expense_date DESC, e.created_at DESC
                """
            ),
            {"user_id": user_id}
        ).all()

        results = []
        for r in rows:
            pending_count = connection.execute(
                text(
                    """
                    SELECT COUNT(*) 
                    FROM public.session_expense_payments 
                    WHERE expense_id = :expense_id AND status = 'pending'
                    """
                ),
                {"expense_id": r.id}
            ).scalar()

            # Lấy participant id của user hiện tại trong buổi chơi này
            my_participant = connection.execute(
                text(
                    """
                    SELECT id FROM public.session_expense_participants 
                    WHERE expense_id = :expense_id AND user_id = :user_id 
                    LIMIT 1
                    """
                ),
                {"expense_id": r.id, "user_id": user_id}
            ).first()
            
            my_pending_amount = 0
            if my_participant:
                my_p_id = my_participant.id
                if r.balance_vnd < 0:
                    # Mình nợ người khác -> Tính tổng số tiền mình chưa trả cho họ
                    my_pending_amount = connection.execute(
                        text(
                            """
                            SELECT COALESCE(SUM(amount_vnd), 0)
                            FROM public.session_expense_payments
                            WHERE expense_id = :expense_id 
                              AND sender_participant_id = :p_id 
                              AND status = 'pending'
                            """
                        ),
                        {"expense_id": r.id, "p_id": my_p_id}
                    ).scalar() or 0
                elif r.balance_vnd > 0:
                    # Người khác nợ mình -> Tính tổng số tiền người khác chưa trả cho mình
                    my_pending_amount = connection.execute(
                        text(
                            """
                            SELECT COALESCE(SUM(amount_vnd), 0)
                            FROM public.session_expense_payments
                            WHERE expense_id = :expense_id 
                              AND receiver_participant_id = :p_id 
                              AND status = 'pending'
                            """
                        ),
                        {"expense_id": r.id, "p_id": my_p_id}
                    ).scalar() or 0

            results.append({
                "id": str(r.id),
                "session_id": str(r.session_id) if r.session_id else None,
                "session_title": str(r.session_title) if r.session_title else None,
                "complex_name": str(r.complex_name) if r.complex_name else None,
                "title": str(r.title),
                "expense_date": r.expense_date.isoformat() if isinstance(r.expense_date, (date, datetime)) else str(r.expense_date),
                "total_amount_vnd": int(r.total_amount_vnd),
                "split_amount_vnd": int(r.split_amount_vnd),
                "my_paid_vnd": int(r.amount_paid_vnd),
                "my_owed_vnd": int(r.amount_owed_vnd),
                "my_balance_vnd": int(r.balance_vnd),
                "my_pending_amount_vnd": int(my_pending_amount),
                "is_fully_settled": int(pending_count) == 0,
                "pending_payments_count": int(pending_count)
            })

        return results


def get_my_pending_payments(*, user_id: str) -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT p.id,
                       p.expense_id,
                       p.amount_vnd,
                       p.status,
                       p.created_at,
                       se.title as expense_title,
                       se.expense_date as expense_date,
                       sp.display_name as sender_name,
                       sp.user_id as sender_user_id,
                       rp.display_name as receiver_name,
                       rp.user_id as receiver_user_id
                FROM public.session_expense_payments p
                JOIN public.session_expenses se ON se.id = p.expense_id
                JOIN public.session_expense_participants sp ON sp.id = p.sender_participant_id
                JOIN public.session_expense_participants rp ON rp.id = p.receiver_participant_id
                WHERE (p.status = 'pending' OR (p.status = 'settled' AND p.settled_at >= NOW() - INTERVAL '7 days'))
                  AND (sp.user_id = :user_id OR rp.user_id = :user_id)
                ORDER BY se.expense_date DESC, p.created_at DESC
                """
            ),
            {"user_id": user_id}
        ).all()

        results = []
        for r in rows:
            results.append({
                "id": str(r.id),
                "expense_id": str(r.expense_id),
                "amount_vnd": int(r.amount_vnd),
                "status": str(r.status),
                "created_at": r.created_at,
                "expense_title": str(r.expense_title),
                "expense_date": r.expense_date.isoformat() if isinstance(r.expense_date, (date, datetime)) else str(r.expense_date),
                "sender_name": str(r.sender_name),
                "sender_user_id": str(r.sender_user_id) if r.sender_user_id else None,
                "receiver_name": str(r.receiver_name),
                "receiver_user_id": str(r.receiver_user_id) if r.receiver_user_id else None,
            })
        return results
