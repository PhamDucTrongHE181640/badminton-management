from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import get_settings

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_ENV_FILE = Path(".env")


@dataclass(frozen=True)
class ProbeResult:
    model_id: str
    display_name: str
    ok: bool
    status_code: int | None
    prompt_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    error: str | None


def _model_id(model: dict[str, Any]) -> str:
    return str(model.get("name") or "").removeprefix("models/")


def _supports_generate_content(model: dict[str, Any]) -> bool:
    methods = model.get("supportedGenerationMethods")
    return isinstance(methods, list) and "generateContent" in methods


def _is_text_video_candidate(model_id: str) -> bool:
    lower = model_id.lower()
    blocked = (
        "embedding",
        "imagen",
        "veo",
        "aqa",
        "tts",
        "live",
        "native-audio",
        "image-generation",
    )
    if any(token in lower for token in blocked):
        return False
    return lower.startswith("gemini-") and (
        "flash" in lower or "pro" in lower
    )


def _preference_score(model_id: str) -> tuple[int, int, int, str]:
    lower = model_id.lower()

    if "flash-lite" in lower:
        family_rank = 0
    elif "flash-8b" in lower:
        family_rank = 1
    elif "flash" in lower:
        family_rank = 2
    elif "pro" in lower:
        family_rank = 10
    else:
        family_rank = 20

    if "2.5" in lower:
        version_rank = 0
    elif "2.0" in lower:
        version_rank = 1
    elif "1.5" in lower:
        version_rank = 2
    else:
        version_rank = 5

    preview_rank = 1 if any(token in lower for token in ("preview", "exp")) else 0
    return (family_rank, preview_rank, version_rank, model_id)


def list_gemini_models(*, api_key: str, timeout_seconds: int) -> list[dict[str, Any]]:
    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.get(
            f"{GEMINI_API_BASE}/models",
            headers={"x-goog-api-key": api_key},
        )
    if response.status_code >= 400:
        raise RuntimeError(
            f"Không list được Gemini models: HTTP {response.status_code} {response.text[:240]}"
        )
    payload = response.json()
    models = payload.get("models")
    if not isinstance(models, list):
        raise RuntimeError("Gemini Models API không trả về danh sách models")
    return [model for model in models if isinstance(model, dict)]


def candidate_models(models: list[dict[str, Any]], *, max_tests: int) -> list[dict[str, Any]]:
    candidates = [
        model
        for model in models
        if _supports_generate_content(model) and _is_text_video_candidate(_model_id(model))
    ]
    candidates.sort(key=lambda model: _preference_score(_model_id(model)))
    return candidates[:max_tests]


def probe_model(*, api_key: str, model: dict[str, Any], timeout_seconds: int) -> ProbeResult:
    model_id = _model_id(model)
    display_name = str(model.get("displayName") or model_id)
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": "Reply with exactly OK."}],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 8,
        },
    }

    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(
                f"{GEMINI_API_BASE}/models/{quote(model_id, safe='')}:generateContent",
                headers={
                    "x-goog-api-key": api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as exc:
        return ProbeResult(
            model_id=model_id,
            display_name=display_name,
            ok=False,
            status_code=None,
            prompt_tokens=None,
            output_tokens=None,
            total_tokens=None,
            error=str(exc),
        )

    if response.status_code >= 400:
        error_payload = response.text[:240].replace("\n", " ")
        return ProbeResult(
            model_id=model_id,
            display_name=display_name,
            ok=False,
            status_code=response.status_code,
            prompt_tokens=None,
            output_tokens=None,
            total_tokens=None,
            error=error_payload,
        )

    response_payload = response.json()
    usage = response_payload.get("usageMetadata") or {}
    return ProbeResult(
        model_id=model_id,
        display_name=display_name,
        ok=True,
        status_code=response.status_code,
        prompt_tokens=_optional_int(usage.get("promptTokenCount")),
        output_tokens=_optional_int(usage.get("candidatesTokenCount")),
        total_tokens=_optional_int(usage.get("totalTokenCount")),
        error=None,
    )


def _optional_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    return None


def update_env_value(*, env_file: Path, key: str, value: str) -> None:
    lines = env_file.read_text(encoding="utf-8").splitlines() if env_file.exists() else []
    updated = False
    next_lines: list[str] = []
    for line in lines:
        if line.startswith(f"{key}="):
            next_lines.append(f"{key}={value}")
            updated = True
        else:
            next_lines.append(line)
    if not updated:
        next_lines.append(f"{key}={value}")
    env_file.write_text("\n".join(next_lines) + "\n", encoding="utf-8")


def print_result(result: ProbeResult) -> None:
    if result.ok:
        usage = {
            "prompt_tokens": result.prompt_tokens,
            "output_tokens": result.output_tokens,
            "total_tokens": result.total_tokens,
        }
        print(f"OK   {result.model_id}  usage={json.dumps(usage, ensure_ascii=False)}")
        return
    print(f"FAIL {result.model_id}  status={result.status_code}  error={result.error}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Probe Gemini models available for the configured GEMINI_API_KEY."
    )
    parser.add_argument("--max-tests", type=int, default=12)
    parser.add_argument("--timeout-seconds", type=int, default=20)
    parser.add_argument("--update-env", action="store_true")
    parser.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    args = parser.parse_args()

    settings = get_settings()
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY chưa được cấu hình trong backend/.env")

    models = list_gemini_models(
        api_key=settings.gemini_api_key,
        timeout_seconds=args.timeout_seconds,
    )
    candidates = candidate_models(models, max_tests=max(1, args.max_tests))
    print(
        f"Gemini API key hợp lệ để list models. "
        f"Tìm thấy {len(models)} models, test {len(candidates)} candidates."
    )

    results = [
        probe_model(
            api_key=settings.gemini_api_key,
            model=model,
            timeout_seconds=args.timeout_seconds,
        )
        for model in candidates
    ]
    for result in results:
        print_result(result)

    working = [result for result in results if result.ok]
    if not working:
        raise SystemExit("Không có model candidate nào chạy được generateContent với API key này")

    selected = working[0]
    print(f"SELECTED {selected.model_id}")

    if args.update_env:
        update_env_value(
            env_file=Path(args.env_file),
            key="GEMINI_MODEL",
            value=selected.model_id,
        )
        print(f"UPDATED {args.env_file}: GEMINI_MODEL={selected.model_id}")


if __name__ == "__main__":
    main()
