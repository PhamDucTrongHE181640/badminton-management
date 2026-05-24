from __future__ import annotations

from fastapi.testclient import TestClient


def test_live_health(client: TestClient) -> None:
    response = client.get("/api/v1/health/live", headers={"X-Request-ID": "test-live"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "test-live"
    assert response.json()["status"] == "ok"


def test_ready_health_success(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.api.health.check_database_ready", lambda: True)

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ready"}


def test_ready_health_failure(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr("app.api.health.check_database_ready", lambda: False)

    response = client.get("/api/v1/health/ready", headers={"X-Request-ID": "test-ready"})

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "database_unavailable",
            "message": "Database readiness check failed",
            "request_id": "test-ready",
        }
    }
