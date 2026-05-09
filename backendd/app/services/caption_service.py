import logging
import os
import asyncio
import threading
import base64
import mimetypes
from collections import OrderedDict
from typing import Any

import httpx
import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

HF_CAPTION_MODEL_ID = settings.HF_CAPTION_MODEL_ID
HF_CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions"
CAPTION_TIMEOUT_SECONDS = 45
CAPTION_MAX_CONCURRENCY = 3
CAPTION_MAX_RETRIES = 3
CAPTION_FALLBACK = "No reliable caption available (caption service error)."
CAPTION_DISABLED = "No caption available because HF_API_TOKEN is not configured."
_MAX_CACHE_SIZE = 128
_caption_cache: OrderedDict[tuple[str, float], str] = OrderedDict()


def get_hf_headers() -> dict:
    """
    Builds Authorization headers for Hugging Face Inference API.
    """
    if not settings.HF_API_TOKEN:
        return {}
    return {"Authorization": f"Bearer {settings.HF_API_TOKEN}"}


def _image_to_data_url(image_path: str) -> str:
    mime_type = mimetypes.guess_type(image_path)[0] or "image/png"
    with open(image_path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _extract_chat_content(payload: Any) -> str:
    if isinstance(payload, dict):
        choices = payload.get("choices") or []
        if choices:
            message = choices[0].get("message") or {}
            content = message.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
            reasoning = message.get("reasoning_content")
            if isinstance(reasoning, str) and reasoning.strip():
                return reasoning.strip()

    return CAPTION_FALLBACK


def _get_cached_caption(cache_key: tuple[str, float]) -> str | None:
    caption = _caption_cache.get(cache_key)
    if caption is None:
        return None
    _caption_cache.move_to_end(cache_key)
    return caption


def _set_cached_caption(cache_key: tuple[str, float], caption: str) -> None:
    _caption_cache[cache_key] = caption
    _caption_cache.move_to_end(cache_key)
    while len(_caption_cache) > _MAX_CACHE_SIZE:
        _caption_cache.popitem(last=False)


async def generate_caption_async(image_path: str, session: httpx.AsyncClient) -> str:
    if not settings.HF_API_TOKEN:
        logger.warning("HF_API_TOKEN is not configured; skipping caption generation for %s", image_path)
        return CAPTION_DISABLED

    try:
        modified_time = os.path.getmtime(image_path)
    except OSError as exc:
        logger.warning("Could not read image metadata for caption generation: %s", exc)
        return CAPTION_FALLBACK

    cache_key = (image_path, modified_time)
    cached_caption = _get_cached_caption(cache_key)
    if cached_caption is not None:
        return cached_caption

    try:
        image_url = _image_to_data_url(image_path)
    except OSError as exc:
        logger.warning("Could not read image for async caption generation %s: %s", image_path, exc)
        return CAPTION_FALLBACK

    caption = CAPTION_FALLBACK
    for attempt in range(1, CAPTION_MAX_RETRIES + 1):
        try:
            response = await session.post(
                HF_CHAT_COMPLETIONS_URL,
                headers={
                    "Authorization": f"Bearer {settings.HF_API_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": f"{HF_CAPTION_MODEL_ID}:zai-org",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Analyze this security camera keyframe. Give one concise sentence describing the visible scene and any readable text.",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": image_url},
                                },
                            ],
                        }
                    ],
                    "max_tokens": 256,
                },
            )
            if not response.is_success:
                logger.warning(
                    "HF async caption status=%s for %s body=%s",
                    response.status_code,
                    image_path,
                    response.text[:300],
                )
            response.raise_for_status()
            caption = _extract_chat_content(response.json())
            if caption != CAPTION_FALLBACK:
                break
            logger.warning("HF async caption returned empty content for %s on attempt %s", image_path, attempt)
        except httpx.HTTPError as exc:
            logger.warning("HF async caption request failed for %s on attempt %s: %s", image_path, attempt, exc)
        except ValueError as exc:
            logger.warning("HF async caption response was not valid JSON for %s on attempt %s: %s", image_path, attempt, exc)

        if attempt < CAPTION_MAX_RETRIES:
            await asyncio.sleep(1.5 * attempt)

    _set_cached_caption(cache_key, caption)
    return caption


async def _generate_captions_batch_async(image_paths: list[str]) -> list[str]:
    timeout = httpx.Timeout(CAPTION_TIMEOUT_SECONDS)
    semaphore = asyncio.Semaphore(CAPTION_MAX_CONCURRENCY)
    async with httpx.AsyncClient(timeout=timeout) as session:
        async def caption_with_limit(path: str) -> str:
            async with semaphore:
                return await generate_caption_async(path, session)

        results = await asyncio.gather(
            *(caption_with_limit(path) for path in image_paths),
            return_exceptions=True,
        )
    captions: list[str] = []
    for path, result in zip(image_paths, results):
        if isinstance(result, Exception):
            logger.warning("HF async caption failed for %s: %s", path, result)
            captions.append(CAPTION_FALLBACK)
        else:
            captions.append(result)
    return captions


def _run_coro_from_sync(coro):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    result = None
    error = None

    def runner():
        nonlocal result, error
        try:
            result = asyncio.run(coro)
        except Exception as exc:
            error = exc

    thread = threading.Thread(target=runner)
    thread.start()
    thread.join()
    if error is not None:
        raise error
    return result


def generate_captions_batch(image_paths: list[str]) -> list[str]:
    if not image_paths:
        return []
    if not settings.HF_API_TOKEN:
        logger.warning("HF_API_TOKEN is not configured; skipping batch caption generation")
        return [CAPTION_DISABLED for _ in image_paths]
    try:
        return _run_coro_from_sync(_generate_captions_batch_async(image_paths))
    except Exception as exc:
        logger.warning("HF caption batch generation failed: %s", exc)
        return [CAPTION_FALLBACK for _ in image_paths]


def generate_caption(image_path: str) -> str:
    if not settings.HF_API_TOKEN:
        logger.warning("HF_API_TOKEN is not configured; skipping caption generation for %s", image_path)
        return CAPTION_DISABLED

    try:
        modified_time = os.path.getmtime(image_path)
    except OSError as exc:
        logger.warning("Could not read image metadata for caption generation: %s", exc)
        return CAPTION_FALLBACK

    cache_key = (image_path, modified_time)
    cached_caption = _get_cached_caption(cache_key)
    if cached_caption is not None:
        return cached_caption

    try:
        image_url = _image_to_data_url(image_path)
        response = requests.post(
            HF_CHAT_COMPLETIONS_URL,
            headers={
                "Authorization": f"Bearer {settings.HF_API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "model": f"{HF_CAPTION_MODEL_ID}:zai-org",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Analyze this security camera keyframe. Give one concise sentence describing the visible scene and any readable text.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url},
                            },
                        ],
                    }
                ],
                "max_tokens": 512,
            },
            timeout=CAPTION_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        caption = _extract_chat_content(response.json())
    except requests.RequestException as exc:
        logger.warning("HF caption request failed for %s: %s", image_path, exc)
        caption = CAPTION_FALLBACK
    except ValueError as exc:
        logger.warning("HF caption response was not valid JSON for %s: %s", image_path, exc)
        caption = CAPTION_FALLBACK
    except OSError as exc:
        logger.warning("Could not read image for caption generation %s: %s", image_path, exc)
        caption = CAPTION_FALLBACK

    _set_cached_caption(cache_key, caption)
    return caption
