import logging
import os
import base64
import mimetypes
from collections import OrderedDict

import requests

from app.core.config import ENV_FILE, settings

logger = logging.getLogger(__name__)

HF_CAPTION_MODEL_ID = settings.HF_CAPTION_MODEL_ID
HF_CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions"
CAPTION_FALLBACK = "No reliable caption available (caption service error)."
CAPTION_DISABLED = "Caption not generated for this keyframe."
_MAX_CACHE_SIZE = 128
_caption_cache: OrderedDict[tuple[str, float], str] = OrderedDict()


def _image_to_data_url(image_path: str) -> str:
    mime_type = mimetypes.guess_type(image_path)[0] or "image/png"
    with open(image_path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _extract_chat_content(output) -> str:
    # 1. Handle object-like output (e.g. from SDK if it were used)
    choices = getattr(output, "choices", None)
    if choices:
        message = getattr(choices[0], "message", None)
        content = getattr(message, "content", None)
        if isinstance(content, str) and content.strip():
            return content.strip()
        # Fallback to reasoning_content if content is empty
        reasoning = getattr(message, "reasoning_content", None)
        if isinstance(reasoning, str) and reasoning.strip():
            return reasoning.strip()

    # 2. Handle dict output (from requests.json())
    if isinstance(output, dict):
        choices = output.get("choices") or []
        if choices:
            message = choices[0].get("message") or {}
            content = message.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
            
            # Fallback to reasoning_content
            reasoning = message.get("reasoning_content")
            if isinstance(reasoning, str) and reasoning.strip():
                # If it's reasoning content, it might be long. 
                # Let's return it but logging it might be better.
                return reasoning.strip()
                
    # 3. Last resort: if we have a message but no content, return a fallback instead of the whole JSON
    if isinstance(output, dict) and "choices" in output:
        return "Caption generation truncated or empty."

    return str(output).strip()


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


def generate_caption(image_path: str) -> str:
    logger.warning(
        "CAPTION_DEBUG requested path=%s token_configured=%s token_length=%s env_file=%s model=%s provider=zai-org",
        image_path,
        bool(settings.HF_API_TOKEN),
        len(settings.HF_API_TOKEN or ""),
        ENV_FILE,
        HF_CAPTION_MODEL_ID,
    )
    if not settings.HF_API_TOKEN:
        logger.warning("HF_API_TOKEN is not configured; skipping caption generation for %s", image_path)
        return CAPTION_DISABLED

    try:
        modified_time = os.path.getmtime(image_path)
        image_size = os.path.getsize(image_path)
    except OSError as exc:
        logger.warning("Could not read image metadata for caption generation: %s", exc)
        return CAPTION_FALLBACK

    cache_key = (image_path, modified_time)
    cached_caption = _get_cached_caption(cache_key)
    if cached_caption is not None:
        logger.warning("CAPTION_DEBUG cache_hit path=%s", image_path)
        return cached_caption

    try:
        logger.warning("CAPTION_DEBUG sending_to_hf_openai_compatible size_bytes=%s", image_size)
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
            timeout=20,
        )
        logger.warning("CAPTION_DEBUG hf_status=%s content_type=%s", response.status_code, response.headers.get("content-type"))
        if not response.ok:
            logger.warning("HF caption error body=%s", response.text[:500])
        response.raise_for_status()
        payload = response.json()
        logger.warning("CAPTION_DEBUG hf_payload_keys=%s", list(payload.keys()) if isinstance(payload, dict) else type(payload).__name__)
        caption = _extract_chat_content(payload)
        if not caption:
            caption = CAPTION_FALLBACK
        logger.warning("CAPTION_DEBUG final_caption=%s", caption)
    except (requests.RequestException, ValueError) as exc:
        logger.warning("HF caption generation failed for %s: %s", image_path, exc)
        caption = CAPTION_FALLBACK

    _set_cached_caption(cache_key, caption)
    return caption
