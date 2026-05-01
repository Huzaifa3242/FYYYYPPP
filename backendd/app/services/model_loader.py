# app/services/model_loader.py

from functools import lru_cache
from pathlib import Path
from typing import List

import torch
import torch.nn as nn
import timm
from torchvision.transforms import Compose, Resize, CenterCrop, ToTensor, Normalize
from PIL import Image

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

CLASS_NAMES: List[str] = [
    "Normal",
    "Arrest",
    "Assault",
    "Stealing",
    "Arson",
    "Abuse",
    "Fighting",
    "Explosion",
    "Shoplifting",
    "Shooting",
]

IMG_SIZE = 224
INPUT_DIM = 768


class GRUClassifier(nn.Module):
    def __init__(
        self,
        input_dim: int = INPUT_DIM,
        hidden_dim: int = 256,
        num_layers: int = 2,
        num_classes: int = len(CLASS_NAMES),
        dropout: float = 0.3,
    ):
        super().__init__()
        self.gru = nn.GRU(
            input_dim,
            hidden_dim,
            num_layers,
            batch_first=True,
            dropout=dropout,
            bidirectional=True,
        )
        self.fc = nn.Linear(hidden_dim * 2, num_classes)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, T, D]
        out, _ = self.gru(x)
        out = out[:, -1, :]          # last time-step
        out = self.dropout(out)
        out = self.fc(out)
        return out


@lru_cache(maxsize=1)
def get_feature_extractor():
    model = timm.create_model(
        "convnextv2_tiny",
        pretrained=True,
        num_classes=0,
        global_pool="avg",
    ).to(DEVICE)
    model.eval()

    transform = Compose(
        [
            Resize(256),
            CenterCrop(IMG_SIZE),
            ToTensor(),
            Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ]
    )
    return model, transform


@lru_cache(maxsize=1)
def get_gru_model(checkpoint_path: str = "ucf_gru_model.pth") -> GRUClassifier:
    ckpt = Path(checkpoint_path)
    if not ckpt.exists():
        raise FileNotFoundError(f"GRU checkpoint not found at {ckpt.resolve()}")

    model = GRUClassifier().to(DEVICE)
    state = torch.load(ckpt, map_location=DEVICE)

    # adjust if saved as {"model_state_dict": ...}
    if "model_state_dict" in state:
        state = state["model_state_dict"]

    model.load_state_dict(state)
    model.eval()
    return model
