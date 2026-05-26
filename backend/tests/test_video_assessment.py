from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core.dependencies import require_player
from app.main import app
from app.services.player_video_assessment import normalize_llm_assessment_result
from app.services.user_auth import UserPrincipal


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


def setup_function() -> None:  # type: ignore[no-untyped-def]
    _clear_overrides()


def teardown_function() -> None:  # type: ignore[no-untyped-def]
    _clear_overrides()


def _player() -> UserPrincipal:
    return UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Nguoi choi",
        avatar_url=None,
        roles=["player"],
    )


def test_post_player_video_assessment_endpoint(  # type: ignore[no-untyped-def]
    client: TestClient, monkeypatch
) -> None:
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 26, 8, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_assessment.get_video_assessment_limits",
        lambda: {
            "max_size_mb": 5,
            "max_size_bytes": 5 * 1024 * 1024,
            "max_duration_seconds": 60,
        },
    )
    monkeypatch.setattr(
        "app.api.player_assessment.create_video_assessment",
        lambda **_: {
            "assessment_id": "assessment-id",
            "sport": "Badminton",
            "status": "uploaded",
            "llm_provider": "gemini",
            "llm_model": "gemini-3.5-flash",
            "file_size_bytes": 12,
            "duration_seconds": None,
            "computed_skill_tier": None,
            "confidence": None,
            "summary": None,
            "strengths": [],
            "improvement_areas": [],
            "warning": None,
            "error_message": None,
            "created_at": now,
            "updated_at": now,
        },
    )
    monkeypatch.setattr(
        "app.api.player_assessment.analyze_video_assessment_job",
        lambda **_: None,
    )

    response = client.post(
        "/api/v1/player/video-assessments",
        data={"sport": "Badminton"},
        files={"video": ("clip.mp4", b"fake-content", "video/mp4")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["assessment_id"] == "assessment-id"
    assert payload["status"] == "uploaded"


def test_get_player_video_assessment_endpoint(  # type: ignore[no-untyped-def]
    client: TestClient, monkeypatch
) -> None:
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 26, 8, 5, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_assessment.get_video_assessment",
        lambda **_: {
            "assessment_id": "assessment-id",
            "sport": "Tennis",
            "status": "completed",
            "llm_provider": "gemini",
            "llm_model": "gemini-3.5-flash",
            "file_size_bytes": 1024,
            "duration_seconds": 24.5,
            "computed_skill_tier": "Intermediate",
            "confidence": 0.82,
            "summary": "Kiểm soát bóng ổn định.",
            "strengths": ["Di chuyển tốt"],
            "improvement_areas": ["Ổn định giao bóng"],
            "warning": None,
            "error_message": None,
            "created_at": now,
            "updated_at": now,
        },
    )

    response = client.get("/api/v1/player/video-assessments/assessment-id")

    assert response.status_code == 200
    payload = response.json()
    assert payload["computed_skill_tier"] == "Intermediate"
    assert payload["confidence"] == 0.82


def test_normalize_llm_assessment_result_clamps_low_confidence() -> None:
    result = normalize_llm_assessment_result(
        sport="Football",
        llm_result={
            "sport": "Football",
            "technical_score": 120,
            "movement_score": -10,
            "consistency_score": 61,
            "game_reading_score": 54,
            "suggested_skill_tier": "Advanced",
            "suggested_initial_elo": 1900,
            "confidence": 0.2,
            "strengths": ["Chuyền bóng nhanh"],
            "improvement_areas": ["Quay video rõ hơn"],
            "summary": "Video chưa đủ rõ nhưng có vài pha xử lý bóng.",
        },
    )

    assert result["technical_score"] == 100
    assert result["movement_score"] == 0
    assert result["suggested_initial_elo"] == 1000
    assert result["suggested_skill_tier"] == "Beginner"
    assert result["warning"] is not None
