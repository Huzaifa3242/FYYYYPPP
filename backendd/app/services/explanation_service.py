import logging
from typing import Dict, List, Tuple

from app.core.config import settings

from . import caption_service
from .video_inference import sample_keyframes_for_segments

logger = logging.getLogger(__name__)


def build_segment_explanations(
    segments: List[Dict],
    frames_timeline: List[Tuple[float, str]],
    max_segments: int = 5,
) -> List[Dict]:
    """
    High-level explainability builder.
    """
    if not segments or not frames_timeline:
        return []

    anomalous_segments = [
        segment
        for segment in segments
        if (segment.get("class_name") or segment.get("classname")) != "Normal"
    ]
    if not anomalous_segments:
        return []

    sampled_segments = sample_keyframes_for_segments(
        frames_timeline=frames_timeline,
        segments=anomalous_segments,
        max_segments=max_segments,
    )

    if not sampled_segments:
        return []

    logger.info(
        "Explainability caption check: sampled_segments=%s token_configured=%s",
        len(sampled_segments),
        bool(settings.HF_API_TOKEN),
    )

    if not settings.HF_API_TOKEN:
        logger.warning("HF_API_TOKEN is not configured; returning keyframes without HF captions")

    explanations: List[Dict] = []

    for segment in sampled_segments:
        keyframes = []
        for keyframe in segment.get("keyframes", []):
            path = keyframe.get("path")
            if not path:
                continue
            if settings.HF_API_TOKEN:
                caption = caption_service.generate_caption(path)
            else:
                caption = caption_service.CAPTION_DISABLED
            keyframes.append(
                {
                    "time_sec": float(keyframe.get("time_sec", 0.0)),
                    "path": path,
                    "caption": caption,
                }
            )

        explanations.append(
            {
                "classname": segment.get("classname"),
                "confidence": float(segment.get("confidence", 0.0)),
                "start_time_sec": float(segment.get("start_time_sec", 0.0)),
                "end_time_sec": float(segment.get("end_time_sec", 0.0)),
                "keyframes": keyframes,
            }
        )

    total_keyframes = sum(len(segment.get("keyframes", [])) for segment in explanations)
    logger.info(
        "Built segment explanations for %s segments with %s keyframes",
        len(explanations),
        total_keyframes,
    )
    return explanations
