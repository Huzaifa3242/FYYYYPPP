# app/services/video_inference.py

import logging
import math
import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Tuple

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image

from app.core.config import settings

from .model_loader import (
    DEVICE,
    CLASS_NAMES,
    INPUT_DIM,
    IMG_SIZE,
    get_feature_extractor,
    get_gru_model,
)


FPS = 2
WINDOW_SIZE = 32
STRIDE = 16
CHUNK_MINUTES = 30
TMP_FRAMES_DIR = Path("tmp_frames")
logger = logging.getLogger(__name__)


# ---------- helpers ----------

def get_video_duration_sec(path: str) -> float:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    cap.release()
    if frame_count == 0:
        return 0.0
    return frame_count / fps


def extract_frames_for_chunk(
    video_path: str,
    start_sec: float,
    duration_sec: float,
    fps: int = FPS,
) -> List[str]:
    """
    Extract frames of one chunk using ffmpeg -ss -t.
    Returns list of frame paths.
    """
    TMP_FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    frame_prefix = f"chunk_{int(start_sec * 1000):012d}_frame"
    pattern = str(TMP_FRAMES_DIR / f"{frame_prefix}_%05d.png")

    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        str(start_sec),
        "-t",
        str(duration_sec),
        "-i",
        video_path,
        "-vf",
        f"fps={fps}",
        pattern,
    ]
    subprocess.run(
        cmd,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    frames = sorted(str(p) for p in TMP_FRAMES_DIR.glob(f"{frame_prefix}_*.png"))
    return frames


class FrameDataset(Dataset):
    def __init__(self, frame_paths: List[str]):
        self.paths = frame_paths
        self.feat_model, self.transform = get_feature_extractor()

    def __len__(self) -> int:
        return len(self.paths)

    def __getitem__(self, idx: int) -> torch.Tensor:
        p = self.paths[idx]
        img = cv2.imread(p)
        if img is None:
            img = np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(img)
        tensor = self.transform(pil)
        return tensor


def frames_to_embeddings(frame_paths: List[str], batch_size: int = 32) -> np.ndarray:
    if not frame_paths:
        return np.zeros((0, INPUT_DIM), dtype=np.float32)

    ds = FrameDataset(frame_paths)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=False, num_workers=0)

    model, _ = get_feature_extractor()
    feats = []
    with torch.no_grad():
        for imgs in loader:
            imgs = imgs.to(DEVICE)
            out = model(imgs)
            feats.append(out.cpu().numpy())
    if not feats:
        return np.zeros((0, INPUT_DIM), dtype=np.float32)
    return np.concatenate(feats, axis=0)


def make_windows(embs: np.ndarray) -> np.ndarray:
    T = embs.shape[0]
    if T == 0:
        return np.zeros((0, WINDOW_SIZE, INPUT_DIM), dtype=np.float32)

    if T < WINDOW_SIZE:
        pad = np.repeat(embs[-1:], WINDOW_SIZE - T, axis=0)
        seq = np.concatenate([embs, pad], axis=0)
        return seq[None, :, :]

    windows = []
    for start in range(0, T - WINDOW_SIZE + 1, STRIDE):
        windows.append(embs[start : start + WINDOW_SIZE])
    return np.stack(windows, axis=0)


def predict_windows(windows: np.ndarray, batch_size: int = 32) -> np.ndarray:
    if windows.shape[0] == 0:
        return np.zeros((0, len(CLASS_NAMES)), dtype=np.float32)

    model = get_gru_model()
    all_probs: List[np.ndarray] = []

    with torch.no_grad():
        for i in range(0, windows.shape[0], batch_size):
            batch = windows[i : i + batch_size]
            x = torch.tensor(batch, dtype=torch.float32, device=DEVICE)
            logits = model(x)
            probs = F.softmax(logits, dim=1).cpu().numpy()
            all_probs.append(probs)

    return np.concatenate(all_probs, axis=0)


def collect_anomaly_segments(
    window_probs: np.ndarray,
    fps: int,
    threshold: float = 0.6,
) -> List[Dict[str, Any]]:
    """
    Convert window-level probs to time segments (start/end in seconds).
    """
    segments: List[Dict[str, Any]] = []
    win_len_frames = WINDOW_SIZE
    step_frames = STRIDE

    for i, probs in enumerate(window_probs):
        cls_idx = int(probs.argmax())
        cls_name = CLASS_NAMES[cls_idx]
        conf = float(probs.max())

        if cls_name == "Normal":
            continue
        if conf < threshold:
            continue

        start_frame = i * step_frames
        end_frame = start_frame + win_len_frames
        start_sec = start_frame / fps
        end_sec = end_frame / fps

        if end_sec <= start_sec:
            continue

        segments.append(
            {
                "class_name": cls_name,
                "confidence": conf,
                "start_time_sec": start_sec,
                "end_time_sec": end_sec,
            }
        )

    return segments


def build_frame_timeline(
    frame_paths: List[str],
    fps: float,
    chunk_start_sec: float,
) -> List[Tuple[float, str]]:
    """
    Given a list of extracted frame file paths in chronological order
    (as produced by extract_frames_for_chunk), the FPS, and the chunk's
    start time in seconds, return a list of (time_sec, path) pairs.
    """
    if not frame_paths or fps <= 0:
        return []

    return [
        (chunk_start_sec + index / fps, path)
        for index, path in enumerate(frame_paths)
    ]


def sample_keyframes_for_segments(
    frames_timeline: List[Tuple[float, str]],
    segments: List[Dict],
    max_segments: int = 4,
    total_hard_cap: int = 80,
) -> List[Dict]:
    """
    Select a small adaptive set of keyframes for the most confident anomaly segments.
    """
    if not frames_timeline:
        return []

    anomalous_segments = [
        segment
        for segment in segments
        if (segment.get("class_name") or segment.get("classname")) != "Normal"
    ]
    if not anomalous_segments:
        return []

    selected_segments = sorted(
        anomalous_segments,
        key=lambda segment: float(segment.get("confidence", 0.0)),
        reverse=True,
    )[:max_segments]

    sampled_segments: List[Dict] = []

    for segment in selected_segments:
        start_time = float(segment.get("start_time_sec", 0.0))
        end_time = float(segment.get("end_time_sec", start_time))
        duration = max(0.0, end_time - start_time)
        base = math.ceil(duration / 4.0) if duration > 0 else 1
        frames_per_segment = min(max(base, 4), 20)

        if frames_per_segment == 1 or end_time <= start_time:
            target_times = [start_time]
        else:
            step = duration / (frames_per_segment - 1)
            target_times = [start_time + step * index for index in range(frames_per_segment)]

        keyframes: List[Dict[str, Any]] = []
        used_paths: set[str] = set()

        for target_time in target_times:
            closest_time, closest_path = min(
                frames_timeline,
                key=lambda item: abs(item[0] - target_time),
            )
            if closest_path in used_paths:
                continue
            used_paths.add(closest_path)
            keyframes.append(
                {
                    "time_sec": float(closest_time),
                    "path": closest_path,
                }
            )

        sampled_segments.append(
            {
                "classname": segment.get("class_name") or segment.get("classname"),
                "confidence": float(segment.get("confidence", 0.0)),
                "start_time_sec": start_time,
                "end_time_sec": end_time,
                "keyframes": keyframes,
            }
        )

    total_keyframes = sum(len(segment.get("keyframes", [])) for segment in sampled_segments)
    if total_keyframes > total_hard_cap:
        counts = [len(segment.get("keyframes", [])) for segment in sampled_segments]
        quotas = [count * total_hard_cap / total_keyframes for count in counts]
        keep_counts = [
            min(count, max(1, int(math.floor(quota)))) if count else 0
            for count, quota in zip(counts, quotas)
        ]
        remaining = total_hard_cap - sum(keep_counts)
        order = sorted(
            range(len(counts)),
            key=lambda index: quotas[index] - math.floor(quotas[index]),
            reverse=True,
        )
        for index in order:
            if remaining <= 0:
                break
            if keep_counts[index] < counts[index]:
                keep_counts[index] += 1
                remaining -= 1

        for segment, keep_count in zip(sampled_segments, keep_counts):
            keyframes = segment.get("keyframes", [])
            if len(keyframes) <= keep_count:
                continue
            if keep_count <= 1:
                segment["keyframes"] = [keyframes[len(keyframes) // 2]]
                continue
            indices = {
                round(index * (len(keyframes) - 1) / (keep_count - 1))
                for index in range(keep_count)
            }
            segment["keyframes"] = [
                keyframe for index, keyframe in enumerate(keyframes) if index in indices
            ]

    return sampled_segments


# ---------- public API ----------

def run_video_inference(
    video_path: str,
    conf_threshold: float = 0.6,
) -> Dict[str, Any]:
    """
    Main entry: handle 30-minute chunking + per-chunk inference.
    """
    duration = get_video_duration_sec(video_path)
    if duration == 0:
        raise RuntimeError("Could not determine video duration")

    chunk_seconds = CHUNK_MINUTES * 60
    num_chunks = max(1, math.ceil(duration / chunk_seconds))

    results: Dict[str, Any] = {
        "video_path": video_path,
        "duration_sec": duration,
        "chunk_seconds": chunk_seconds,
        "chunks": [],
    }
    anomaly_segments: List[Dict[str, Any]] = []
    frames_timeline: List[Tuple[float, str]] = []

    try:
        if TMP_FRAMES_DIR.exists():
            shutil.rmtree(TMP_FRAMES_DIR, ignore_errors=True)

        for chunk_idx in range(num_chunks):
            start_sec = chunk_idx * chunk_seconds
            remaining = max(0.0, duration - start_sec)
            if remaining <= 0:
                break
            this_dur = min(chunk_seconds, remaining)

            frames = extract_frames_for_chunk(video_path, start_sec, this_dur, fps=FPS)
            current_timeline = build_frame_timeline(frames, fps=float(FPS), chunk_start_sec=start_sec)
            frames_timeline.extend(current_timeline)
            embs = frames_to_embeddings(frames)
            windows = make_windows(embs)
            window_probs = predict_windows(windows)

            if window_probs.shape[0] == 0:
                chunk_overall = {
                    "top_class": "Unknown",
                    "confidence": 0.0,
                }
                segments: List[Dict[str, Any]] = []
            else:
                avg_prob = window_probs.mean(axis=0)
                top_idx = int(avg_prob.argmax())
                chunk_overall = {
                    "top_class": CLASS_NAMES[top_idx],
                    "confidence": float(avg_prob[top_idx]),
                }
                segments = collect_anomaly_segments(
                    window_probs,
                    fps=FPS,
                    threshold=conf_threshold,
                )

                # shift times by chunk start
                for seg in segments:
                    seg["start_time_sec"] += start_sec
                    seg["end_time_sec"] += start_sec
                anomaly_segments.extend(segments)

            results["chunks"].append(
                {
                    "chunk_index": chunk_idx,
                    "start_time_sec": start_sec,
                    "duration_sec": this_dur,
                    "overall": chunk_overall,
                    "segments": segments,
                }
            )

        # simple global summary from all chunks
        all_chunk_probs: List[Tuple[str, float]] = []
        for ch in results["chunks"]:
            all_chunk_probs.append(
                (ch["overall"]["top_class"], ch["overall"]["confidence"])
            )

        if all_chunk_probs:
            # pick chunk with highest confidence abnormal class, else normal
            best = max(all_chunk_probs, key=lambda x: x[1])
            results["overall_summary"] = {
                "top_class": best[0],
                "confidence": best[1],
                "status": "normal"
                if best[0] == "Normal"
                else "abnormal",
            }
        else:
            results["overall_summary"] = {
                "top_class": "Unknown",
                "confidence": 0.0,
                "status": "unknown",
            }

        if settings.ENABLE_EXPLAINABILITY and anomaly_segments:
            try:
                from . import explanation_service

                segment_explanations = explanation_service.build_segment_explanations(
                    segments=anomaly_segments,
                    frames_timeline=frames_timeline,
                    max_segments=4,
                )
                from .explainability_assets import persist_segment_explanation_frames

                segment_explanations = persist_segment_explanation_frames(segment_explanations)
                total_keyframes = sum(
                    len(segment.get("keyframes", [])) for segment in segment_explanations
                )
                logger.info(
                    "Generated segment_explanations for %s segments and %s keyframes",
                    len(segment_explanations),
                    total_keyframes,
                )
            except Exception as exc:
                logger.warning("Segment explainability generation failed: %s", exc)
                segment_explanations = []
        else:
            segment_explanations = []

        results["segment_explanations"] = segment_explanations
        return results
    finally:
        # cleanup frames
        if TMP_FRAMES_DIR.exists():
            shutil.rmtree(TMP_FRAMES_DIR, ignore_errors=True)
