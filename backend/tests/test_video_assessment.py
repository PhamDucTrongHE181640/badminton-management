from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.core.dependencies import require_player
from app.main import app
from app.services import player_video_assessment as video_service
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
            "technical_score": None,
            "movement_score": None,
            "consistency_score": None,
            "game_reading_score": None,
            "aspect_evaluations": [],
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
            "technical_score": 72,
            "movement_score": 68,
            "consistency_score": 65,
            "game_reading_score": 70,
            "aspect_evaluations": [
                {
                    "key": "technical",
                    "label": "Kỹ thuật",
                    "score": 72,
                    "tier": "Intermediate",
                    "feedback": "Kiểm soát bóng ổn.",
                    "evidence": "Có vài pha giữ nhịp tốt.",
                    "improvement_tip": "Tập thêm điểm tiếp xúc.",
                }
            ],
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
    assert len(result["aspect_evaluations"]) == 4
    assert result["aspect_evaluations"][0]["key"] == "technical"
    assert result["aspect_evaluations"][0]["score"] == 100
    assert result["suggested_initial_elo"] == 1000
    assert result["suggested_skill_tier"] == "Beginner"
    assert result["warning"] is not None


def test_complete_video_assessment_reassessment_updates_elo_without_new_assessment(
    monkeypatch,
) -> None:
    class FakeResult:
        def __init__(self, *, first=None, one=None) -> None:  # type: ignore[no-untyped-def]
            self._first = first
            self._one = one

        def first(self):  # type: ignore[no-untyped-def]
            return self._first

        def one(self):  # type: ignore[no-untyped-def]
            return self._one

    class FakeConnection:
        def __init__(self) -> None:
            self.statements: list[str] = []
            self.history_params: dict[str, object] | None = None
            self.audit_events: list[str] = []

        def execute(self, statement, params=None):  # type: ignore[no-untyped-def]
            sql = str(statement)
            self.statements.append(sql)
            if params and "event_type" in params:
                self.audit_events.append(str(params["event_type"]))
            if "INSERT INTO public.elo_rating_history" in sql:
                self.history_params = dict(params)
            if "FROM public.video_assessments" in sql and "FOR UPDATE" in sql:
                return FakeResult(
                    first=SimpleNamespace(
                        id="video-id",
                        player_user_id="player-id",
                        status="analyzing",
                    )
                )
            if "FROM public.player_assessments" in sql:
                return FakeResult(first=SimpleNamespace(id="existing-assessment-id"))
            if "FROM public.elo_ratings" in sql:
                return FakeResult(first=SimpleNamespace(elo_value=1200))
            return FakeResult()

    class FakeBegin:
        def __init__(self, connection: FakeConnection) -> None:
            self.connection = connection

        def __enter__(self) -> FakeConnection:
            return self.connection

        def __exit__(self, *_args) -> None:  # type: ignore[no-untyped-def]
            return None

    class FakeEngine:
        def __init__(self) -> None:
            self.connection = FakeConnection()

        def begin(self) -> FakeBegin:
            return FakeBegin(self.connection)

    fake_engine = FakeEngine()
    monkeypatch.setattr(video_service, "get_engine", lambda: fake_engine)

    video_service._complete_video_assessment(
        assessment_id="video-id",
        llm_raw_response={"ok": True},
        normalized_result={
            "sport": "Badminton",
            "suggested_initial_elo": 1380,
            "suggested_skill_tier": "Intermediate",
            "confidence": 0.82,
        },
    )

    player_assessment_inserts = [
        statement
        for statement in fake_engine.connection.statements
        if "INSERT INTO public.player_assessments" in statement
    ]
    assert player_assessment_inserts == []
    assert fake_engine.connection.history_params is not None
    assert (
        fake_engine.connection.history_params["reason"]
        == "video_reassessment:Badminton:video-id"
    )
    assert "elo_reassessed_from_video" in fake_engine.connection.audit_events
