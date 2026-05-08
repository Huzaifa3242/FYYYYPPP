from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class TrainingAnswer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # Can be email or user ID string
    scenario_id: str = Field(index=True)  # e.g., "Abuse", "Arrest", "Shooting2"
    selected_label: str
    is_correct: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
