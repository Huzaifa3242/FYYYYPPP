import shutil
from pathlib import Path
from uuid import uuid4

EXPLAINABILITY_FRAMES_DIR = Path(__file__).resolve().parents[2] / "explainability_frames"
EXPLAINABILITY_FRAMES_URL_PREFIX = "/explainability-frames"


def persist_segment_explanation_frames(segment_explanations: list[dict]) -> list[dict]:
    if not segment_explanations:
        return []

    EXPLAINABILITY_FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    persisted_segments: list[dict] = []

    for segment in segment_explanations:
        persisted_keyframes = []
        for keyframe in segment.get("keyframes", []):
            source_path = Path(str(keyframe.get("path", "")))
            if not source_path.exists() or not source_path.is_file():
                persisted_keyframes.append(dict(keyframe))
                continue

            filename = f"{uuid4().hex}{source_path.suffix or '.png'}"
            target_path = EXPLAINABILITY_FRAMES_DIR / filename
            shutil.copy2(source_path, target_path)

            rewritten_keyframe = dict(keyframe)
            rewritten_keyframe["path"] = f"{EXPLAINABILITY_FRAMES_URL_PREFIX}/{filename}"
            persisted_keyframes.append(rewritten_keyframe)

        persisted_segment = dict(segment)
        persisted_segment["keyframes"] = persisted_keyframes
        persisted_segments.append(persisted_segment)

    return persisted_segments
