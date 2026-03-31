import asyncio
import base64
import os
import time
from typing import Any, Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

# Later lines in `.env` must win over earlier ones (e.g. placeholder `KEY=` then real `KEY=...`).
# Default `override=False` skips re-assignments once a key exists, so an empty line can block real keys.
load_dotenv(override=True)

app = FastAPI()

_DEV_ORIGINS = (
    os.environ.get("WEB_ORIGIN", "").strip() or "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def _cors_headers(request: Request) -> dict[str, str]:
    origin = (request.headers.get("origin") or "").strip()
    if origin in _DEV_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    """Ensure CORS headers exist on error responses (browser shows real error, not opaque CORS failure)."""
    headers = {**_cors_headers(request)}
    detail = exc.detail
    body: dict[str, Any] = {"detail": detail if isinstance(detail, (str, list, dict)) else str(detail)}
    return JSONResponse(status_code=exc.status_code, content=body, headers=headers)


@app.exception_handler(Exception)
async def unhandled_exc_handler(request: Request, exc: Exception):
    headers = {**_cors_headers(request)}
    return JSONResponse(status_code=500, content={"detail": str(exc)}, headers=headers)


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_DEV_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai"}


@app.get("/v1/insights/daily-summary")
def get_daily_summary():
    return {"summary": "Placeholder summary"}


class EzriChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    provider: str = Field(default="groq")
    userid: str = Field(default="anon")
    session_id: str = Field(default="session")


class EzriChatResponse(BaseModel):
    text: str
    raw: Any


class EzriSpeakRequest(BaseModel):
    text: str = Field(..., min_length=1)
    tts_provider: str = Field(default="pocket_tts")


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _openai_headers() -> dict[str, str]:
    key = _env("OPENAI_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="Missing env OPENAI_API_KEY")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _openai_responses_text(prompt: str, *, userid: str) -> tuple[str, Any]:
    model = (_env("OPENAI_MODEL") or "gpt-4.1-mini").strip()
    url = "https://api.openai.com/v1/responses"
    payload: dict[str, Any] = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_text", "text": prompt}],
            }
        ],
        "safety_identifier": (userid or "anon")[:64],
    }
    res = requests.post(url, headers=_openai_headers(), json=payload, timeout=60)
    if not res.ok:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    raw = res.json()

    text_parts: list[str] = []
    for item in raw.get("output", []) or []:
        if not isinstance(item, dict):
            continue
        if item.get("type") != "message":
            continue
        for c in item.get("content", []) or []:
            if isinstance(c, dict) and c.get("type") == "output_text" and isinstance(c.get("text"), str):
                text_parts.append(c["text"])
    text = "".join(text_parts).strip()
    if not text:
        candidate = raw.get("output_text")
        if isinstance(candidate, str) and candidate.strip():
            text = candidate.strip()
    if not text:
        raise HTTPException(status_code=502, detail="Model returned no text output.")
    return text, raw


def _groq_chat_text(prompt: str) -> tuple[str, Any]:
    key = _env("GROQ_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="Missing env GROQ_API_KEY")
    model = (_env("GROQ_MODEL") or "llama-3.3-70b-versatile").strip()
    url = "https://api.groq.com/openai/v1/chat/completions"
    res = requests.post(
        url,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Ezri, a warm, supportive voice companion. "
                        "Keep replies concise and natural for spoken conversation."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.7,
            "max_tokens": 1024,
        },
        timeout=60,
    )
    if not res.ok:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    raw = res.json()
    choices = raw.get("choices") or []
    if not choices:
        raise HTTPException(status_code=502, detail="Groq returned no choices")
    msg = choices[0].get("message") or {}
    text = (msg.get("content") or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="Groq returned empty content")
    return text, raw


def _brain_text(prompt: str, *, userid: str, provider: str) -> tuple[str, Any]:
    p = (provider or "").strip().lower()
    if p in {"groq"}:
        return _groq_chat_text(prompt)
    if p in {"openai", "gpt", "ezri"}:
        if _env("OPENAI_API_KEY"):
            return _openai_responses_text(prompt, userid=userid)
        if _env("GROQ_API_KEY"):
            return _groq_chat_text(prompt)
        raise HTTPException(status_code=500, detail="Missing env OPENAI_API_KEY or GROQ_API_KEY")
    raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")


def _openai_tts_bytes(text: str) -> tuple[bytes, str]:
    model = (_env("OPENAI_TTS_MODEL") or "gpt-4o-mini-tts").strip()
    voice = (_env("OPENAI_TTS_VOICE") or "coral").strip()
    response_format = (_env("OPENAI_TTS_FORMAT") or "mp3").strip()
    url = "https://api.openai.com/v1/audio/speech"
    payload = {"model": model, "input": text, "voice": voice, "response_format": response_format}
    res = requests.post(url, headers=_openai_headers(), json=payload, timeout=120)
    if not res.ok:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    content_type = res.headers.get("content-type") or "audio/mpeg"
    return res.content, content_type


def _extract_audio_b64_from_runpod_output(out: Any) -> tuple[str, Optional[str]]:
    """Find base64 audio + optional mime in nested RunPod worker output."""

    def walk(node: Any, depth: int = 0) -> Optional[tuple[str, Optional[str]]]:
        if depth > 12 or node is None:
            return None
        if isinstance(node, str) and len(node) > 200 and not node.startswith("http"):
            # Heuristic: long string — likely base64 from TTS workers
            return node, None
        if isinstance(node, dict):
            for k, v in node.items():
                kl = k.lower()
                if kl in {"audio_base64", "audiobase64", "b64", "data", "mp3_base64", "wav_base64"}:
                    if isinstance(v, str) and v:
                        mime = None
                        if isinstance(node.get("mime_type"), str):
                            mime = node["mime_type"]
                        elif isinstance(node.get("content_type"), str):
                            mime = node["content_type"]
                        return v, mime
                if kl == "audio" and isinstance(v, str):
                    if v.startswith("http://") or v.startswith("https://"):
                        return None
                    if len(v) > 64:
                        return v, node.get("mime_type") if isinstance(node.get("mime_type"), str) else None
            for v in node.values():
                found = walk(v, depth + 1)
                if found:
                    return found
        if isinstance(node, list):
            for item in node:
                found = walk(item, depth + 1)
                if found:
                    return found
        return None

    found = walk(out)
    if not found:
        raise HTTPException(
            status_code=502,
            detail="RunPod TTS output did not contain recognizable base64 audio. "
            "Ensure the worker returns output with audio_base64 (or similar).",
        )
    return found


def _runpod_decode_worker_output(output: Any) -> tuple[bytes, str]:
    if output is None:
        raise HTTPException(status_code=502, detail="RunPod returned no output")

    if isinstance(output, dict):
        for k in ("audio_url", "audioUrl", "url", "file_url", "wav_url", "mp3_url"):
            v = output.get(k)
            if isinstance(v, str) and v.startswith("http"):
                r2 = requests.get(v, timeout=120)
                if not r2.ok:
                    raise HTTPException(status_code=502, detail=f"Failed to fetch audio URL: {r2.status_code}")
                ct = r2.headers.get("content-type") or "audio/mpeg"
                return r2.content, ct

    if isinstance(output, str) and output.startswith("http"):
        r2 = requests.get(output, timeout=120)
        if not r2.ok:
            raise HTTPException(status_code=502, detail=f"Failed to fetch audio URL: {r2.status_code}")
        ct = r2.headers.get("content-type") or "audio/mpeg"
        return r2.content, ct

    b64, mime_hint = _extract_audio_b64_from_runpod_output(output)
    raw = b64.strip()
    if raw.startswith("data:"):
        try:
            head, b64part = raw.split(",", 1)
            mime = "audio/mpeg"
            if ";" in head:
                mime = head.split("data:", 1)[-1].split(";", 1)[0].strip() or mime
            return base64.b64decode(b64part), mime
        except Exception:
            raise HTTPException(status_code=502, detail="Invalid data: URL audio from RunPod")

    mime = (mime_hint or "audio/mpeg").split(";")[0].strip()
    try:
        decoded = base64.b64decode(raw, validate=False)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Invalid base64 audio from RunPod: {e}")
    return decoded, mime


def _runpod_tts_bytes(text: str) -> tuple[bytes, str]:
    api_key = _env("RUNPOD_API_KEY")
    endpoint = _env("RUNPOD_TTS_ENDPOINT_ID")
    if not api_key or not endpoint:
        raise HTTPException(status_code=500, detail="Missing RUNPOD_API_KEY or RUNPOD_TTS_ENDPOINT_ID")

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    # Some workers expect `prompt` instead of `text`
    payload: dict[str, Any] = {"input": {"text": text, "prompt": text}}

    # Prefer runsync; if it returns IN_QUEUE / IN_PROGRESS with an id, poll that id (do not enqueue twice).
    wait_ms = int((_env("RUNPOD_TTS_WAIT_MS") or "180000").strip() or "180000")
    wait_ms = max(1000, min(wait_ms, 300_000))
    sync_url = f"https://api.runpod.ai/v2/{endpoint}/runsync?wait={wait_ms}"
    job_id: str | None = None
    res = requests.post(
        sync_url,
        headers=headers,
        json=payload,
        timeout=max(60, wait_ms // 1000 + 25),
    )
    if res.ok:
        data = res.json()
        if data.get("status") == "COMPLETED" and data.get("output") is not None:
            return _runpod_decode_worker_output(data.get("output"))
        job_id = data.get("id")

    if not job_id:
        run_url = f"https://api.runpod.ai/v2/{endpoint}/run"
        res = requests.post(run_url, headers=headers, json=payload, timeout=60)
        if not res.ok:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        data = res.json()
        job_id = data.get("id")
    if not job_id:
        raise HTTPException(status_code=502, detail="RunPod returned no job id")

    poll_sec = int((_env("RUNPOD_TTS_POLL_SECONDS") or "300").strip() or "300")
    deadline = time.time() + max(30, poll_sec)
    status_url = f"https://api.runpod.ai/v2/{endpoint}/status/{job_id}"

    while time.time() < deadline:
        sr = requests.get(status_url, headers={"Authorization": f"Bearer {api_key}"}, timeout=45)
        if not sr.ok:
            time.sleep(2)
            continue
        sj = sr.json()
        st = sj.get("status")
        if st == "COMPLETED":
            return _runpod_decode_worker_output(sj.get("output"))
        if st in ("FAILED", "CANCELLED", "TIMED_OUT", "ERROR"):
            raise HTTPException(status_code=502, detail=f"RunPod TTS job {st}: {sj}")
        time.sleep(2)

    raise HTTPException(
        status_code=504,
        detail="RunPod TTS timed out while waiting for a worker. Check RunPod endpoint workers/queue or increase RUNPOD_TTS_POLL_SECONDS.",
    )


def _normalize_tts_provider(raw: str) -> str:
    s = (raw or "pocket_tts").strip().lower().replace("-", "_")
    if s in {"pockettts"}:
        return "pocket_tts"
    return s


def _tts_bytes(text: str, tts_provider: str) -> tuple[bytes, str]:
    p = _normalize_tts_provider(tts_provider)

    if p == "browser":
        raise HTTPException(status_code=400, detail="browser TTS is client-side only")

    runpod_ready = bool(_env("RUNPOD_API_KEY") and _env("RUNPOD_TTS_ENDPOINT_ID"))

    # pocket_tts / HF-style: RunPod only (never OpenAI).
    if p in {"pocket_tts", "runpod", "hf"}:
        if not runpod_ready:
            raise HTTPException(
                status_code=500,
                detail="pocket_tts requires RUNPOD_API_KEY and RUNPOD_TTS_ENDPOINT_ID in apps/ai/.env "
                "(remove duplicate empty lines like RUNPOD_API_KEY= above the real key, or restart after fix).",
            )
        return _runpod_tts_bytes(text)

    if p in {"openai"}:
        if _env("OPENAI_API_KEY"):
            return _openai_tts_bytes(text)
        if runpod_ready:
            return _runpod_tts_bytes(text)
        raise HTTPException(
            status_code=500,
            detail="tts_provider openai needs OPENAI_API_KEY, or set RunPod TTS env vars for fallback.",
        )

    if runpod_ready:
        return _runpod_tts_bytes(text)
    if _env("OPENAI_API_KEY"):
        return _openai_tts_bytes(text)
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported tts_provider: {tts_provider!r}. Use pocket_tts, openai, or browser.",
    )


@app.post("/api/v1/chat", response_model=EzriChatResponse)
def ezri_chat(req: EzriChatRequest):
    text, raw = _brain_text(req.prompt, userid=req.userid, provider=req.provider)
    return EzriChatResponse(text=text, raw=raw)


@app.post("/api/v1/speak")
def ezri_speak(req: EzriSpeakRequest):
    audio_bytes, content_type = _tts_bytes(req.text, req.tts_provider)
    return Response(content=audio_bytes, media_type=content_type)


@app.websocket("/api/v1/ws/active")
async def ezri_ws_active(
    websocket: WebSocket,
    brain_provider: Optional[str] = None,
    tts_provider: Optional[str] = None,
    stt_provider: Optional[str] = None,
    userid: str = "anon",
    session_id: str = "session",
):
    await websocket.accept()
    is_bot_speaking = False
    try:
        while True:
            message = await websocket.receive()

            # We currently support JSON control/messages (chat + playback_done).
            # Binary PCM streaming (backend STT) is not implemented in this simplified backend.
            if "bytes" in message and message["bytes"] is not None:
                # Ignore raw audio frames for now (keeps compatibility with clients that send them).
                continue

            if "text" not in message or message["text"] is None:
                continue

            parsed = None
            try:
                parsed = json.loads(message["text"])
            except Exception:
                await websocket.send_json({"type": "error", "message": "Invalid JSON message."})
                continue

            if not isinstance(parsed, dict):
                await websocket.send_json({"type": "error", "message": "Invalid message."})
                continue

            msg = parsed

            mtype = (msg.get("type") or "").strip().lower()
            if mtype == "playback_done":
                # Client finished playing (or interrupted) — reopen mic on server-side state.
                is_bot_speaking = False
                continue

            if mtype != "chat":
                await websocket.send_json({"type": "unknown", "raw": msg})
                continue

            text_in = (msg.get("text") or "").strip()
            if not text_in:
                await websocket.send_json({"type": "error", "message": "Missing chat text."})
                continue

            try:
                _ = (stt_provider, session_id)
                brain = (brain_provider or _env("EZRI_DEFAULT_BRAIN") or "groq").strip()
                tts = (tts_provider or _env("EZRI_DEFAULT_TTS") or "pocket_tts").strip()

                # Match Ai/websockets.py high-level protocol.
                is_bot_speaking = True
                await websocket.send_json({"type": "transcription", "user": text_in})
                await websocket.send_json({"type": "step", "status": "thinking", "message": "Generating response..."})

                # Never block the asyncio event loop with sync HTTP (Groq/RunPod) — that freezes all WS clients.
                text_out, _raw = await asyncio.to_thread(
                    _brain_text, text_in, userid=userid, provider=brain
                )
                await websocket.send_json({"type": "transcription", "ai": text_out})
                await websocket.send_json({"type": "assistant_final", "text": text_out})

                ws_audio_enabled = (_env("EZRI_WS_AUDIO") or "1").strip().lower() not in {"0", "false", "no"}
                if ws_audio_enabled and tts.lower() != "browser":
                    audio_bytes, _ct = await asyncio.to_thread(_tts_bytes, text_out, tts)
                    await websocket.send_json({"type": "step", "status": "speaking", "message": "Synthesizing audio..."})

                    # Stream bytes in chunks to mimic the engineer's streaming behavior,
                    # then signal definitive completion with tts_done.
                    chunk_size = 32 * 1024
                    for i in range(0, len(audio_bytes), chunk_size):
                        await websocket.send_bytes(audio_bytes[i : i + chunk_size])
                    await websocket.send_json({"type": "tts_done"})
                else:
                    await websocket.send_json({"type": "tts_done"})
            except HTTPException as e:
                is_bot_speaking = False
                detail = e.detail if isinstance(e.detail, str) else str(e.detail)
                await websocket.send_json({"type": "error", "message": detail})
            except Exception as e:
                is_bot_speaking = False
                await websocket.send_json({"type": "error", "message": str(e)})
    except WebSocketDisconnect:
        return
