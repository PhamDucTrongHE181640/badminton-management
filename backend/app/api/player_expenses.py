from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_player
from app.services.user_auth import UserPrincipal
from app.services import player_expenses

router = APIRouter(prefix="/player/expenses", tags=["player-expenses"])


class ParticipantInput(BaseModel):
    display_name: str
    user_id: str | None = None
    is_guest: bool = False


class ItemInput(BaseModel):
    name: str
    amount_vnd: int
    paid_by_display_name: str
    split_between_display_names: list[str] | None = None


class CreateUpdateExpenseInput(BaseModel):
    session_id: str | None = None
    title: str
    expense_date: str
    notes: str | None = None
    participants: list[ParticipantInput] = Field(default_factory=list)
    items: list[ItemInput] = Field(default_factory=list)


class TogglePaymentStatusInput(BaseModel):
    status: str


@router.get("/history")
def get_my_expenses_history(
    user: UserPrincipal = Depends(require_player)
) -> list[dict[str, Any]]:
    return player_expenses.get_my_expenses_history(user_id=user.id)


@router.get("/pending-payments")
def get_my_pending_payments(
    user: UserPrincipal = Depends(require_player)
) -> list[dict[str, Any]]:
    return player_expenses.get_my_pending_payments(user_id=user.id)



@router.get("/session/{session_id}")
def get_or_init_session_expenses(
    session_id: str,
    user: UserPrincipal = Depends(require_player)
) -> dict[str, Any]:
    return player_expenses.get_or_init_session_expenses(session_id=session_id, actor_user_id=user.id)


@router.get("/detail/{expense_id}")
def get_expense_detail_by_id(
    expense_id: str,
    user: UserPrincipal = Depends(require_player)
) -> dict[str, Any]:
    return player_expenses.get_expense_detail_by_id(expense_id=expense_id, actor_user_id=user.id)


@router.post("")
def create_or_update_expense(
    data: CreateUpdateExpenseInput,
    expense_id: str | None = Query(None),
    user: UserPrincipal = Depends(require_player)
) -> dict[str, Any]:
    return player_expenses.create_or_update_expense(
        expense_id=expense_id,
        session_id=data.session_id,
        created_by_user_id=user.id,
        data=data.model_dump()
    )


@router.post("/payments/{payment_id}/toggle")
def toggle_payment_status(
    payment_id: str,
    data: TogglePaymentStatusInput,
    user: UserPrincipal = Depends(require_player)
) -> dict[str, Any]:
    return player_expenses.toggle_payment_status(
        payment_id=payment_id,
        status=data.status,
        actor_user_id=user.id
    )
