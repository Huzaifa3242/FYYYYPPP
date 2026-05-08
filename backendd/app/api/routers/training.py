from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select, func
from typing import List, Optional
import random

from app.db.session import get_session
from app.models.training import TrainingAnswer
from app.schemas.training import (
    TrainingScenario,
    Question,
    AnswerSubmit,
    AnswerResult,
    ProgressStats,
    PerLabelStat,
    TrainingSession,
)

router = APIRouter(prefix="/training", tags=["training"])

# Training scenarios data - based on actual videos in the backendd/videos folder
# This is structured so it can later be moved to database or config file
# Each scenario has 3 questions: Classification, Threat Level, and Response Action

TRAINING_SCENARIOS: List[TrainingScenario] = [
    TrainingScenario(
        id="Abuse",
        title="Training Scenario A",
        description="Analyze the footage and assess the security situation.",
        video_filename="Abuse.mp4",
        correct_label="Abuse",
        options=["Abuse", "Arrest", "Assault"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Abuse", "Arrest", "Assault"],
                correct_answer="Abuse"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["Low", "Medium", "High"],
                correct_answer="High"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Monitor", "Alert security", "Call police"],
                correct_answer="Alert security"
            ),
        ],
    ),
    TrainingScenario(
        id="Arrest",
        title="Training Scenario B",
        description="Analyze the footage and assess the security situation.",
        video_filename="Arrest.mp4",
        correct_label="Arrest",
        options=["Arrest", "Assault", "Normal"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Arrest", "Assault", "Normal"],
                correct_answer="Arrest"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["Low", "Medium", "High"],
                correct_answer="Medium"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Monitor", "Alert security", "Call police"],
                correct_answer="Monitor"
            ),
        ],
    ),
    TrainingScenario(
        id="Assault",
        title="Training Scenario C",
        description="Analyze the footage and assess the security situation.",
        video_filename="Assault.mp4",
        correct_label="Assault",
        options=["Abuse", "Assault", "Normal"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Abuse", "Assault", "Normal"],
                correct_answer="Assault"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["Low", "Medium", "High"],
                correct_answer="High"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Monitor", "Alert security", "Call police"],
                correct_answer="Call police"
            ),
        ],
    ),
    TrainingScenario(
        id="Explosion",
        title="Training Scenario D",
        description="Analyze the footage and assess the security situation.",
        video_filename="Explosion.mp4",
        correct_label="Explosion",
        options=["Explosion", "Fire", "Normal"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Explosion", "Fire", "Normal"],
                correct_answer="Explosion"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["Medium", "High", "Critical"],
                correct_answer="Critical"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Alert security", "Call police", "Evacuate"],
                correct_answer="Evacuate"
            ),
        ],
    ),
    TrainingScenario(
        id="Explosion2",
        title="Training Scenario E",
        description="Analyze the footage and assess the security situation.",
        video_filename="Explosion2.mp4",
        correct_label="Explosion",
        options=["Explosion", "Fire", "Accident"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Explosion", "Fire", "Accident"],
                correct_answer="Explosion"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["Medium", "High", "Critical"],
                correct_answer="Critical"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Alert security", "Call police", "Evacuate"],
                correct_answer="Evacuate"
            ),
        ],
    ),
    TrainingScenario(
        id="Normal",
        title="Training Scenario F",
        description="Analyze the footage and assess the security situation.",
        video_filename="Normal.mp4",
        correct_label="Normal",
        options=["Normal", "Suspicious", "Threat"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Normal", "Suspicious", "Threat"],
                correct_answer="Normal"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["Low", "Medium", "High"],
                correct_answer="Low"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Monitor", "Alert security", "Call police"],
                correct_answer="Monitor"
            ),
        ],
    ),
    TrainingScenario(
        id="Shooting",
        title="Training Scenario G",
        description="Analyze the footage and assess the security situation.",
        video_filename="Shooting.mp4",
        correct_label="Shooting",
        options=["Shooting", "Fireworks", "Accident"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Shooting", "Fireworks", "Accident"],
                correct_answer="Shooting"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["High", "Critical", "Emergency"],
                correct_answer="Critical"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Hide", "Evacuate", "Confront"],
                correct_answer="Evacuate"
            ),
        ],
    ),
    TrainingScenario(
        id="Shooting2",
        title="Training Scenario H",
        description="Analyze the footage and assess the security situation.",
        video_filename="Shooting2.mp4",
        correct_label="Shooting",
        options=["Shooting", "Fireworks", "Drill"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Shooting", "Fireworks", "Drill"],
                correct_answer="Shooting"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["High", "Critical", "Emergency"],
                correct_answer="Critical"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Hide", "Evacuate", "Shelter"],
                correct_answer="Evacuate"
            ),
        ],
    ),
    TrainingScenario(
        id="Shoplifting",
        title="Training Scenario I",
        description="Analyze the footage and assess the security situation.",
        video_filename="Shoplifting.mp4",
        correct_label="Shoplifting",
        options=["Shoplifting", "Browsing", "Purchase"],
        questions=[
            Question(
                id="q1",
                question_text="What type of event is occurring in this video?",
                options=["Shoplifting", "Browsing", "Purchase"],
                correct_answer="Shoplifting"
            ),
            Question(
                id="q2",
                question_text="What is the immediate threat level?",
                options=["Low", "Medium", "High"],
                correct_answer="Medium"
            ),
            Question(
                id="q3",
                question_text="What is the recommended response?",
                options=["Confront", "Alert security", "Call police"],
                correct_answer="Alert security"
            ),
        ],
    ),
]

# Build a lookup dict for fast access
SCENARIOS_BY_ID = {s.id: s for s in TRAINING_SCENARIOS}


@router.get("/session", response_model=TrainingSession)
def get_training_session(
    user_id: Optional[str] = Query(None, description="User ID for personalized selection"),
    limit: int = Query(3, ge=1, le=5, description="Number of scenarios to return (1-5)"),
    session: Session = Depends(get_session),
):
    """
    Get a random training session with scenarios.
    
    - Returns unique scenarios within the session (no duplicates)
    - If user_id is provided, tries to avoid recently seen scenarios
    - Default limit is 3 scenarios per session
    """
    all_scenarios = list(TRAINING_SCENARIOS)
    
    # If user_id provided, try to prioritize unseen scenarios
    if user_id:
        # Get recent scenarios this user has answered (last 20)
        recent_answers = session.exec(
            select(TrainingAnswer.scenario_id)
            .where(TrainingAnswer.user_id == user_id)
            .order_by(TrainingAnswer.timestamp.desc())
            .limit(20)
        ).all()
        
        recent_set = set(recent_answers)
        
        # Split into unseen and seen
        unseen = [s for s in all_scenarios if s.id not in recent_set]
        seen = [s for s in all_scenarios if s.id in recent_set]
        
        # Shuffle both lists
        random.shuffle(unseen)
        random.shuffle(seen)
        
        # Combine: prefer unseen first, then fill with seen if needed
        ordered = unseen + seen
        
        # Take the requested limit
        selected = ordered[:limit]
    else:
        # No user_id, just shuffle and pick
        selected = random.sample(all_scenarios, min(limit, len(all_scenarios)))
    
    return TrainingSession(
        scenarios=selected,
        session_size=len(selected),
    )


@router.post("/answer", response_model=AnswerResult)
def submit_answer(
    answer: AnswerSubmit,
    session: Session = Depends(get_session),
):
    """
    Submit an answer for a training scenario.
    
    - Records the answer in the database
    - Returns whether the answer was correct
    """
    scenario = SCENARIOS_BY_ID.get(answer.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Check correctness
    is_correct = answer.selected_label == scenario.correct_label
    
    # Save to database
    training_answer = TrainingAnswer(
        user_id=answer.user_id,
        scenario_id=answer.scenario_id,
        selected_label=answer.selected_label,
        is_correct=is_correct,
    )
    session.add(training_answer)
    session.commit()
    
    # Return result
    if is_correct:
        message = "Correct! You identified the scenario accurately."
    else:
        message = f"Incorrect. The correct answer was: {scenario.correct_label}"
    
    return AnswerResult(
        is_correct=is_correct,
        correct_label=scenario.correct_label,
        message=message,
    )


@router.get("/progress", response_model=ProgressStats)
def get_progress(
    user_id: str = Query(..., description="User ID to get progress for"),
    session: Session = Depends(get_session),
):
    """
    Get training progress statistics for a user.
    
    - Returns total attempts, correct count, accuracy percentage
    - Includes per-label breakdown
    - Lists recently answered scenario IDs
    """
    # Get all answers for this user
    answers = session.exec(
        select(TrainingAnswer).where(TrainingAnswer.user_id == user_id)
    ).all()
    
    if not answers:
        return ProgressStats(
            user_id=user_id,
            total_attempts=0,
            correct_attempts=0,
            accuracy=0.0,
            per_label_stats=[],
            recent_scenarios=[],
        )
    
    total = len(answers)
    correct = sum(1 for a in answers if a.is_correct)
    accuracy = (correct / total) * 100 if total > 0 else 0.0
    
    # Per-label stats
    label_stats: dict = {}
    for ans in answers:
        label = ans.selected_label
        if label not in label_stats:
            label_stats[label] = {"attempts": 0, "correct": 0}
        label_stats[label]["attempts"] += 1
        if ans.is_correct:
            label_stats[label]["correct"] += 1
    
    per_label_stats = [
        PerLabelStat(
            label=label,
            attempts=data["attempts"],
            correct=data["correct"],
            accuracy=(data["correct"] / data["attempts"]) * 100 if data["attempts"] > 0 else 0.0,
        )
        for label, data in label_stats.items()
    ]
    
    # Recent scenarios (unique, most recent first)
    seen_order = []
    seen_set = set()
    for ans in sorted(answers, key=lambda x: x.timestamp, reverse=True):
        if ans.scenario_id not in seen_set:
            seen_order.append(ans.scenario_id)
            seen_set.add(ans.scenario_id)
    
    return ProgressStats(
        user_id=user_id,
        total_attempts=total,
        correct_attempts=correct,
        accuracy=round(accuracy, 1),
        per_label_stats=per_label_stats,
        recent_scenarios=seen_order[:10],
    )


@router.get("/scenarios", response_model=List[TrainingScenario])
def list_all_scenarios():
    """
    List all available training scenarios.
    """
    return TRAINING_SCENARIOS
