from __future__ import annotations

from fastapi.testclient import TestClient


def test_not_found_uses_standard_error_shape(client: TestClient) -> None:
    response = client.get("/api/v1/missing", headers={"X-Request-ID": "test-missing"})

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "not_found",
            "message": "Not Found",
            "request_id": "test-missing",
        }
    }
