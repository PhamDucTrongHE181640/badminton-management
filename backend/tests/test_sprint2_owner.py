from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import require_admin, require_owner, require_user
from app.core.errors import AppError
from app.main import app
from app.services.admin_auth import AdminPrincipal
from app.services.owner_inventory import _validate_session_rules
from app.services.user_auth import UserPrincipal


@pytest.fixture
def player() -> UserPrincipal:
    return UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Người chơi",
        avatar_url=None,
        roles=["player"],
    )


@pytest.fixture
def owner() -> UserPrincipal:
    return UserPrincipal(
        id="owner-id",
        email="owner@example.com",
        full_name="Chủ sân",
        avatar_url=None,
        roles=["player", "owner"],
    )


@pytest.fixture
def admin() -> AdminPrincipal:
    return AdminPrincipal(
        id="admin-id",
        user_id="admin-user-id",
        username="admin",
        is_super_admin=True,
    )


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> None:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_owner_request_create(client: TestClient, monkeypatch, player: UserPrincipal) -> None:
    app.dependency_overrides[require_user] = lambda: player
    submitted_at = datetime(2026, 5, 24, 10, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.owner_requests.create_owner_request",
        lambda **_: {
            "id": "request-id",
            "user_id": player.id,
            "business_name": "NetUp Arena",
            "contact_phone": "0900000000",
            "facility_overview": "4 sân cầu lông",
            "status": "pending",
            "submitted_at": submitted_at,
            "reviewed_at": None,
            "reviewed_by": None,
            "review_note": None,
        },
    )

    response = client.post(
        "/api/v1/owner/requests",
        json={
            "business_name": "NetUp Arena",
            "contact_phone": "0900000000",
            "facility_overview": "4 sân cầu lông",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "pending"
    assert response.json()["business_name"] == "NetUp Arena"


def test_admin_approves_owner_request(
    client: TestClient, monkeypatch, admin: AdminPrincipal
) -> None:
    app.dependency_overrides[require_admin] = lambda: admin
    reviewed_at = datetime(2026, 5, 24, 11, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.admin_owner_requests.approve_owner_request",
        lambda **_: {
            "id": "request-id",
            "user_id": "owner-user-id",
            "business_name": "NetUp Arena",
            "contact_phone": "0900000000",
            "facility_overview": "4 sân cầu lông",
            "status": "approved",
            "submitted_at": reviewed_at,
            "reviewed_at": reviewed_at,
            "reviewed_by": admin.user_id,
            "review_note": "Hồ sơ hợp lệ",
            "user_email": "owner@example.com",
            "user_full_name": "Chủ sân",
        },
    )

    response = client.post(
        "/api/v1/admin/owner-requests/request-id/approve",
        json={"review_note": "Hồ sơ hợp lệ"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert response.json()["reviewed_by"] == admin.user_id


def test_owner_post_quota_endpoint(
    client: TestClient, monkeypatch, owner: UserPrincipal
) -> None:
    app.dependency_overrides[require_owner] = lambda: owner
    monkeypatch.setattr(
        "app.api.owner_inventory.get_owner_post_quota",
        lambda **_: {
            "owner_user_id": owner.id,
            "rental_post_limit": 10,
            "slot_post_limit": 10,
            "rental_posts_used": 2,
            "slot_posts_used": 3,
            "rental_posts_remaining": 8,
            "slot_posts_remaining": 7,
            "updated_at": None,
        },
    )

    response = client.get("/api/v1/owner/post-quota")

    assert response.status_code == 200
    assert response.json()["rental_posts_remaining"] == 8


def test_admin_updates_owner_post_quota(
    client: TestClient, monkeypatch, admin: AdminPrincipal
) -> None:
    app.dependency_overrides[require_admin] = lambda: admin
    monkeypatch.setattr(
        "app.api.admin_owner_quotas.update_owner_post_quota_for_admin",
        lambda **_: {
            "owner_user_id": "owner-id",
            "owner_full_name": "Chủ sân",
            "owner_email": "owner@example.com",
            "rental_post_limit": 20,
            "slot_post_limit": 15,
            "rental_posts_used": 2,
            "slot_posts_used": 3,
            "rental_posts_remaining": 18,
            "slot_posts_remaining": 12,
            "updated_at": None,
        },
    )

    response = client.put(
        "/api/v1/admin/owner-post-quotas/owner-id",
        json={"rental_post_limit": 20, "slot_post_limit": 15},
    )

    assert response.status_code == 200
    assert response.json()["slot_post_limit"] == 15


def test_owner_session_create_endpoint(
    client: TestClient, monkeypatch, owner: UserPrincipal
) -> None:
    app.dependency_overrides[require_owner] = lambda: owner
    starts_at = datetime(2026, 5, 25, 9, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.owner_inventory.create_session",
        lambda **_: {
            "id": "session-id",
            "court_id": "court-id",
            "created_by_user_id": owner.id,
            "title": "Cầu lông sáng",
            "post_type": "pool",
            "status": "scheduled",
            "starts_at": starts_at,
            "duration_minutes": 60,
            "ends_at": starts_at,
            "open_slots": 4,
            "max_slots": 4,
            "required_skill_min": "Beginner",
            "required_skill_max": "Advanced",
            "slot_price_vnd": 80000,
            "full_court_price_vnd": 300000,
            "is_peak_hour": False,
            "allows_solo_join": True,
            "created_at": starts_at,
            "updated_at": starts_at,
        },
    )

    response = client.post(
        "/api/v1/owner/sessions",
        json={
            "court_id": "court-id",
            "title": "Cầu lông sáng",
            "starts_at": "2026-05-25T09:00:00+00:00",
            "duration_minutes": 60,
            "open_slots": 4,
            "max_slots": 4,
            "slot_price_vnd": 80000,
            "full_court_price_vnd": 300000,
        },
    )

    assert response.status_code == 201
    assert response.json()["id"] == "session-id"
    assert response.json()["status"] == "scheduled"


def test_owner_court_create_allows_single_character_name(
    client: TestClient, monkeypatch, owner: UserPrincipal
) -> None:
    app.dependency_overrides[require_owner] = lambda: owner
    created_at = datetime(2026, 5, 24, 12, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.owner_inventory.create_court",
        lambda **_: {
            "id": "court-id",
            "complex_id": "complex-id",
            "owner_user_id": owner.id,
            "name": "1",
            "sub_court_name": "A",
            "sport": "Badminton",
            "status": "active",
            "rating": 0,
            "amenities": [],
            "base_price_vnd": 120000,
            "max_rental_duration_minutes": 120,
            "created_at": created_at,
            "updated_at": created_at,
        },
    )

    response = client.post(
        "/api/v1/owner/courts",
        json={
            "complex_id": "complex-id",
            "name": "1",
            "sub_court_name": "A",
            "sport": "Badminton",
            "base_price_vnd": 120000,
            "max_rental_duration_minutes": 120,
        },
    )

    assert response.status_code == 201
    assert response.json()["name"] == "1"


def test_session_validation_rejects_duration_above_court_limit(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(
        "app.services.owner_inventory._require_court",
        lambda *_args, **_kwargs: SimpleNamespace(max_rental_duration_minutes=60),
    )

    with pytest.raises(AppError) as error:
        _validate_session_rules(
            SimpleNamespace(),
            owner_user_id="owner-id",
            court_id="court-id",
            starts_at=datetime(2026, 5, 25, 9, 0, tzinfo=UTC),
            duration_minutes=90,
            open_slots=4,
            max_slots=4,
            required_skill_min="Beginner",
            required_skill_max="Advanced",
            status="scheduled",
        )

    assert error.value.code == "session_duration_exceeds_court_limit"


def test_session_validation_rejects_overlap(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    class FakeResult:
        def first(self) -> object:
            return object()

    class FakeConnection:
        def execute(self, *_args, **_kwargs) -> FakeResult:
            return FakeResult()

    monkeypatch.setattr(
        "app.services.owner_inventory._require_court",
        lambda *_args, **_kwargs: SimpleNamespace(max_rental_duration_minutes=120),
    )

    with pytest.raises(AppError) as error:
        _validate_session_rules(
            FakeConnection(),
            owner_user_id="owner-id",
            court_id="court-id",
            starts_at=datetime(2026, 5, 25, 9, 0, tzinfo=UTC),
            duration_minutes=60,
            open_slots=4,
            max_slots=4,
            required_skill_min="Beginner",
            required_skill_max="Advanced",
            status="scheduled",
        )

    assert error.value.code == "session_time_overlap"
