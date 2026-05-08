from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field

class AnalysisReport(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    filename: str
    status: str  # "normal" or "abnormal"
    top_class: str
    confidence: float
    duration_sec: float
    llm_report: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
