from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.dependencies import require_owner, require_player
from app.main import app
from app.services import player_payments
from app.services.user_auth import UserPrincipal


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


def setup_function() -> None:  # type: ignore[no-untyped-def]
    _clear_overrides()


def teardown_function() -> None:  # type: ignore[no-untyped-def]
    _clear_overrides()


def _vnpay_settings() -> SimpleNamespace:
    return SimpleNamespace(
        vnpay_payment_url="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
        vnpay_tmn_code="TESTTMN",
        vnpay_hash_secret="test-secret",
        vnpay_return_url="http://localhost:8000/api/v1/payments/vnpay/return",
        vnpay_locale="vn",
        vnpay_order_type="other",
        backend_base_url="http://localhost:8000",
    )


def test_build_vnpay_payment_url_uses_vnpay_required_format() -> None:
    created_at = datetime(2026, 5, 28, 14, 40, 8, tzinfo=UTC)
    expires_at = datetime(2026, 5, 28, 14, 55, 8, tzinfo=UTC)

    url = player_payments._build_vnpay_payment_url(
        settings=_vnpay_settings(),
        external_ref="DEPBK12345678",
        amount_vnd=30000,
        order_info="NetUp deposit BK12345678",
        client_ip="127.0.0.1",
        created_at=created_at,
        expires_at=expires_at,
    )

    parsed = urlparse(url)
    query = {key: values[0] for key, values in parse_qs(parsed.query).items()}
    signed_params = {key: value for key, value in query.items() if key != "vnp_SecureHash"}

    assert parsed.scheme == "https"
    assert query["vnp_Version"] == "2.1.0"
    assert query["vnp_TmnCode"] == "TESTTMN"
    assert query["vnp_TxnRef"] == "DEPBK12345678"
    assert query["vnp_Amount"] == "3000000"
    assert query["vnp_ReturnUrl"] == "http://localhost:8000/api/v1/payments/vnpay/return"
    assert "return_url" not in query
    assert query["vnp_SecureHash"] == player_payments._vnpay_secure_hash(
        signed_params, hash_secret="test-secret"
    )


def test_vnpay_return_rejects_invalid_signature(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("VNPAY_TMN_CODE", "TESTTMN")
    monkeypatch.setenv("VNPAY_HASH_SECRET", "test-secret")
    get_settings.cache_clear()

    result = player_payments.handle_vnpay_return(
        payload={
            "vnp_TxnRef": "DEPBK12345678",
            "vnp_Amount": "3000000",
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_SecureHash": "invalid",
        }
    )

    assert result == {"ok": False, "status": "invalid_signature"}


def test_create_deposit_payment_intent_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    player = UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Player",
        avatar_url=None,
        roles=["player"],
    )
    app.dependency_overrides[require_player] = lambda: player
    expires_at = datetime(2026, 5, 26, 8, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_payments.create_deposit_payment_intent",
        lambda **_: {
            "booking_id": "booking-id",
            "booking_code": "BK123",
            "payment_transaction_id": "payment-id",
            "external_ref": "DEP-BK123",
            "amount_vnd": 30000,
            "status": "processing",
            "expires_at": expires_at,
            "payment_url": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
        },
    )

    response = client.post("/api/v1/player/bookings/booking-id/deposit-payment")

    assert response.status_code == 200
    payload = response.json()
    assert payload["booking_id"] == "booking-id"
    assert payload["status"] == "processing"


def test_vnpay_webhook_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(
        "app.api.player_payments.handle_vnpay_webhook",
        lambda **_: {
            "ok": True,
            "idempotent": False,
            "booking_id": "booking-id",
            "payment_transaction_id": "payment-id",
            "payment_status": "paid",
            "booking_status": "deposit_paid",
        },
    )

    response = client.post(
        "/api/v1/payments/vnpay/webhook",
        json={
            "external_ref": "DEP-BK123",
            "provider_transaction_id": "VNPAY-TXN-1",
            "status": "paid",
            "amount_vnd": 30000,
        },
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["payment_status"] == "paid"


def test_owner_checkin_create_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    owner = UserPrincipal(
        id="owner-id",
        email="owner@example.com",
        full_name="Owner",
        avatar_url=None,
        roles=["player", "owner"],
    )
    app.dependency_overrides[require_owner] = lambda: owner
    checked_in_at = datetime(2026, 5, 26, 9, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.owner_checkins.create_owner_checkin",
        lambda **_: {
            "id": "checkin-id",
            "booking_id": "booking-id",
            "owner_user_id": owner.id,
            "checkin_method": "booking_code",
            "cash_collected_vnd": 70000,
            "note": "Thu tien mat",
            "checked_in_at": checked_in_at,
            "created_at": checked_in_at,
            "booking_code": "BK123",
            "booking_status": "checked_in",
            "payment_method": "cash",
            "remaining_due_vnd": 70000,
            "session_title": "Keo toi",
            "session_starts_at": checked_in_at,
            "complex_name": "NetUp Arena",
            "court_name": "San 1",
            "sub_court_name": "A",
        },
    )

    response = client.post(
        "/api/v1/owner/checkins",
        json={"booking_code": "BK123", "cash_collected_vnd": 70000},
    )

    assert response.status_code == 201
    assert response.json()["id"] == "checkin-id"
    assert response.json()["booking_status"] == "checked_in"
