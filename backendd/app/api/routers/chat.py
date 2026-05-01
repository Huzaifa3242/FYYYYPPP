from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import re
import time
from typing import Iterable

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from groq import Groq

from app.core.config import settings
from app.db.session import get_session
from app.models.chat import ChatMessage, ChatThread
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageRead,
    ChatThreadCreate,
    ChatThreadDetail,
    ChatThreadRead,
)

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _require_groq_key() -> None:
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set")


def _require_any_chat_provider() -> None:
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set")


def _trim_messages_for_context(messages: list[ChatMessage]) -> list[ChatMessage]:
    if not messages:
        return messages
    max_chars = max(100, settings.CHAT_CONTEXT_MAX_CHARS)
    trimmed: list[ChatMessage] = []
    last_index = len(messages) - 1
    for index, msg in enumerate(messages):
        content = msg.content or ""
        # Preserve the latest user message as-is; trim older turns aggressively.
        if index != last_index and len(content) > max_chars:
            content = content[-max_chars:]
        elif index == last_index and len(content) > max_chars * 2:
            content = content[-(max_chars * 2):]
        trimmed.append(
            ChatMessage(
                id=msg.id,
                thread_id=msg.thread_id,
                role=msg.role,
                content=content,
                created_at=msg.created_at,
            )
        )
    return trimmed


def _sanitize_identity_claims(text: str) -> str:
    if not text:
        return text
    sanitized = text
    # Normalize common incorrect self-identity claims from the model.
    sanitized = re.sub(
        r"(?i)i am (?:a )?(?:large language model|language model),?\s*trained by google\.?",
        "I am SecureVision AI powered by Groq.",
        sanitized,
    )
    sanitized = re.sub(
        r"(?i)i am not powered by groq\.?",
        "I am powered by Groq.",
        sanitized,
    )
    sanitized = re.sub(
        r"(?i)i(?:'m| am) (?:not )?(?:a )?(?:gpt model )?from groq\.?",
        "I am SecureVision AI powered by Groq.",
        sanitized,
    )
    sanitized = re.sub(
        r"(?i)\b(?:google|gemini)\b",
        "Groq",
        sanitized,
    )
    return sanitized


def _sanitize_stream_delta(delta: str) -> str:
    if not delta:
        return delta
    sanitized = re.sub(r"(?i)\bgoogle\b", "Groq", delta)
    sanitized = re.sub(r"(?i)\bgemini\b", "Groq", sanitized)
    return sanitized


def _thread_to_read(thread: ChatThread, last_message: str | None) -> ChatThreadRead:
    return ChatThreadRead(
        id=thread.id,
        title=thread.title,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        last_message=last_message,
    )


@router.post("/threads", response_model=ChatThreadRead, status_code=201)
def create_thread(payload: ChatThreadCreate, session: Session = Depends(get_session)):
    thread = ChatThread(title=payload.title)
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return _thread_to_read(thread, last_message=None)


@router.get("/threads", response_model=list[ChatThreadRead])
def list_threads(session: Session = Depends(get_session)):
    threads = session.exec(select(ChatThread).order_by(ChatThread.updated_at.desc())).all()
    results: list[ChatThreadRead] = []
    for thread in threads:
        last = session.exec(
            select(ChatMessage)
            .where(ChatMessage.thread_id == thread.id)
            .order_by(ChatMessage.created_at.desc())
        ).first()
        last_message = last.content if last else None
        results.append(_thread_to_read(thread, last_message=last_message))
    return results


@router.get("/threads/{thread_id}", response_model=ChatThreadDetail)
def get_thread(thread_id: int, session: Session = Depends(get_session)):
    thread = session.get(ChatThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.created_at)
    ).all()

    last_message = messages[-1].content if messages else None
    return ChatThreadDetail(
        thread=_thread_to_read(thread, last_message=last_message),
        messages=[
            ChatMessageRead(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at,
            )
            for msg in messages
        ],
    )


@router.delete("/threads/{thread_id}", status_code=204)
def delete_thread(thread_id: int, session: Session = Depends(get_session)):
    thread = session.get(ChatThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    messages = session.exec(
        select(ChatMessage).where(ChatMessage.thread_id == thread_id)
    ).all()
    for msg in messages:
        session.delete(msg)
    session.delete(thread)
    session.commit()


@router.post("/threads/{thread_id}/messages")
def create_message_stream(
    thread_id: int,
    payload: ChatMessageCreate,
    session: Session = Depends(get_session),
):
    request_started_at = time.perf_counter()
    _require_any_chat_provider()

    thread = session.get(ChatThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    user_message = ChatMessage(
        thread_id=thread_id,
        role="user",
        content=payload.content,
        created_at=_utc_now(),
    )
    session.add(user_message)

    if not thread.title:
        thread.title = payload.content.strip()[:40]
    thread.updated_at = _utc_now()
    session.add(thread)
    session.commit()

    recent_messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(settings.CHAT_CONTEXT_MESSAGES)
    ).all()
    messages = _trim_messages_for_context(list(reversed(recent_messages)))

    system_prompt = (
        "You are a helpful security and crime-prevention assistant. "
        "You are SecureVision AI "
        "Never claim to be Google, Gemini, or any other provider. "
        "If asked about identity, say you are SecureVision AI. "
        "Keep answers concise by default (about 60-100 words) unless the user asks for detail. "
        "You answer questions about crime situations detected from CCTV video. "
        "Explain clearly and avoid technical ML details. "
        "Donot talk extra just keep it concise untill user ask anything"
        # "/no_think"
    )

    def event_stream() -> Iterable[str]:
        # Prompt the client to start rendering immediately.
        yield "event: ping\ndata: {}\n\n"
        full_text = ""
        stream_started_at = time.perf_counter()
        groq_error: str | None = None
        first_chunk_received_ms: int | None = None
        first_chunk_sent_ms: int | None = None

        # Prefer Groq streaming first for lower first-token latency.
        if settings.GROQ_API_KEY:
            groq_client = Groq(
                api_key=settings.GROQ_API_KEY,
                timeout=settings.GROQ_TIMEOUT_SECONDS,
                max_retries=settings.GROQ_MAX_RETRIES,
            )
            groq_messages = [
                {"role": "system", "content": system_prompt},
            ]
            for msg in messages:
                content = msg.content
                if msg.role == "assistant":
                    content = _sanitize_identity_claims(content)
                groq_messages.append({"role": msg.role, "content": content})
            try:
                before_api_call_ms = int((time.perf_counter() - request_started_at) * 1000)
                logger.info(
                    "[CHAT_TIMING] thread=%s before_provider_api_call_ms=%s model=%s",
                    thread_id,
                    before_api_call_ms,
                    settings.GROQ_MODEL,
                )
                completion = groq_client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=groq_messages,
                    temperature=0.4,
                    max_completion_tokens=settings.GROQ_MAX_COMPLETION_TOKENS,
                    stream=True,
                )
                first_chunk_sent = False
                for chunk in completion:
                    delta = chunk.choices[0].delta.content or ""
                    if not delta:
                        continue
                    delta = _sanitize_stream_delta(delta)
                    if first_chunk_received_ms is None:
                        first_chunk_received_ms = int((time.perf_counter() - request_started_at) * 1000)
                        logger.info(
                            "[CHAT_TIMING] thread=%s first_chunk_received_ms=%s",
                            thread_id,
                            first_chunk_received_ms,
                        )
                    if not first_chunk_sent:
                        meta_payload = json.dumps(
                            {
                                "provider": "groq",
                                "ttft_ms": int((time.perf_counter() - stream_started_at) * 1000),
                            }
                        )
                        first_chunk_sent_ms = int((time.perf_counter() - request_started_at) * 1000)
                        logger.info(
                            "[CHAT_TIMING] thread=%s first_chunk_sent_ms=%s",
                            thread_id,
                            first_chunk_sent_ms,
                        )
                        yield f"event: meta\ndata: {meta_payload}\n\n"
                        first_chunk_sent = True
                    full_text += delta
                    payload = json.dumps({"delta": delta})
                    yield f"data: {payload}\n\n"
            except Exception as exc:
                groq_error = str(exc)
                full_text = ""

        if not full_text:
            error_payload = json.dumps(
                {
                    "detail": "Groq did not produce a response in time.",
                    "provider_error": groq_error or "Unknown provider error",
                }
            )
            total_ms = int((time.perf_counter() - request_started_at) * 1000)
            logger.info(
                "[CHAT_TIMING] thread=%s stream_end_ms=%s status=error",
                thread_id,
                total_ms,
            )
            yield f"event: error\ndata: {error_payload}\n\n"
            return

        full_text = _sanitize_identity_claims(full_text)
        assistant_message = ChatMessage(
            thread_id=thread_id,
            role="assistant",
            content=full_text,
            created_at=_utc_now(),
        )
        session.add(assistant_message)
        thread.updated_at = _utc_now()
        session.add(thread)
        session.commit()

        done_payload = json.dumps({"content": full_text})
        yield f"event: done\ndata: {done_payload}\n\n"
        total_ms = int((time.perf_counter() - request_started_at) * 1000)
        logger.info(
            "[CHAT_TIMING] thread=%s stream_end_ms=%s status=ok first_chunk_received_ms=%s first_chunk_sent_ms=%s",
            thread_id,
            total_ms,
            first_chunk_received_ms,
            first_chunk_sent_ms,
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )