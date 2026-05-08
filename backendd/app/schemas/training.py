from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict


class Question(BaseModel):
    id: str
    question_text: str
    options: List[str]
    correct_answer: str


class TrainingScenario(BaseModel):
    id: str
    title: str
    description: str
    video_filename: str
    correct_label: str
    options: List[str]
    questions: List[Question]  # Multiple questions per scenario


class AnswerSubmit(BaseModel):
    user_id: str
    scenario_id: str
    selected_label: str


class AnswerResult(BaseModel):
    is_correct: bool
    correct_label: str
    message: str


class PerLabelStat(BaseModel):
    label: str
    attempts: int
    correct: int
    accuracy: float


class ProgressStats(BaseModel):
    user_id: str
    total_attempts: int
    correct_attempts: int
    accuracy: float
    per_label_stats: List[PerLabelStat]
    recent_scenarios: List[str]  # IDs of recently answered scenarios


class TrainingSession(BaseModel):
    scenarios: List[TrainingScenario]
    session_size: int
