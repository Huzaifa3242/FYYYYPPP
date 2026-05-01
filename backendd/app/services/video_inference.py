# app/services/video_inference.py

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
    if TMP_FRAMES_DIR.exists():
        shutil.rmtree(TMP_FRAMES_DIR, ignore_errors=True)
    TMP_FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    pattern = str(TMP_FRAMES_DIR / "frame_%05d.png")

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

    frames = sorted(str(p) for p in TMP_FRAMES_DIR.glob("frame_*.png"))
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

    for chunk_idx in range(num_chunks):
        start_sec = chunk_idx * chunk_seconds
        remaining = max(0.0, duration - start_sec)
        if remaining <= 0:
            break
        this_dur = min(chunk_seconds, remaining)

        frames = extract_frames_for_chunk(video_path, start_sec, this_dur, fps=FPS)
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

    # cleanup frames
    if TMP_FRAMES_DIR.exists():
        shutil.rmtree(TMP_FRAMES_DIR, ignore_errors=True)

    return results