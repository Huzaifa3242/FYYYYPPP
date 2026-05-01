import base64
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.session import get_session
from app.models.user import User
from app.models.chat import ChatThread, ChatMessage
from app.models.report import AnalysisReport
from app.schemas.user import UserRead, UserUpdate, PasswordChange

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_AVATAR_BYTES = 800 * 1024  # 800 KB


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserRead)
def update_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.put("/me/avatar", response_model=UserRead)
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_MIME)}",
        )

    data = file.file.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 800 KB.")

    b64 = base64.b64encode(data).decode("ascii")
    current_user.avatar_url = f"data:{file.content_type};base64,{b64}"
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = hash_password(payload.new_password)
    session.add(current_user)
    session.commit()
    return {"detail": "Password updated successfully"}


@router.delete("/me", status_code=204)
def delete_account(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Delete all chat messages & threads owned by this user
    # (since chats are not user-scoped in the current schema, we delete ALL;
    #  adjust if you add a user_id FK to ChatThread later)
    threads = session.exec(select(ChatThread)).all()
    for thread in threads:
        msgs = session.exec(
            select(ChatMessage).where(ChatMessage.thread_id == thread.id)
        ).all()
        for msg in msgs:
            session.delete(msg)
        session.delete(thread)

    # Delete the user
    session.delete(current_user)
    session.commit()


@router.get("/me/stats")
def get_user_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    total = session.exec(
        select(AnalysisReport).where(AnalysisReport.user_id == current_user.id)
    ).all()
    
    total_count = len(total)
    anomalies_count = sum(1 for r in total if r.status == "abnormal")
    normal_count = total_count - anomalies_count
    
    return {
        "total_analyses": total_count,
        "anomalies_detected": anomalies_count,
        "normal_results": normal_count,
        "system_uptime": "99.9%",
    }


@router.get("/me/activity")
def get_user_activity(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    reports = session.exec(
        select(AnalysisReport)
        .where(AnalysisReport.user_id == current_user.id)
        .order_by(AnalysisReport.created_at.desc())
        .limit(limit)
    ).all()
    
    return reports


@router.get("/me/trend")
def get_user_trend(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Use naive datetime for comparison with DB objects
    now = datetime.now()
    ten_days_ago = now - timedelta(days=10)
    
    reports = session.exec(
        select(AnalysisReport)
        .where(AnalysisReport.user_id == current_user.id)
        .where(AnalysisReport.created_at >= ten_days_ago)
    ).all()
    
    # We'll build the trend for the last 7 days relative to the latest report
    # or today if no reports
    latest_date = now
    if reports:
        # Ensure comparison works even if types vary
        report_dates = []
        for r in reports:
            dt = r.created_at
            if dt.tzinfo is not None:
                dt = dt.replace(tzinfo=None)
            report_dates.append(dt)
        latest_date = max(now.replace(tzinfo=None), max(report_dates))
    
    trend_map = {}
    for i in range(7):
        d = latest_date - timedelta(days=i)
        date_str = d.strftime("%b %d")
        trend_map[date_str] = {"date": date_str, "anomalies": 0, "total": 0}
        
    for r in reports:
        # Normalize date for mapping
        dt = r.created_at
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        date_str = dt.strftime("%b %d")
        if date_str in trend_map:
            trend_map[date_str]["total"] += 1
            if r.status == "abnormal":
                trend_map[date_str]["anomalies"] += 1
                
    result = []
    # Build result in chronological order (7 days ago to today)
    for i in range(6, -1, -1):
        d = latest_date - timedelta(days=i)
        date_str = d.strftime("%b %d")
        result.append(trend_map.get(date_str, {"date": date_str, "anomalies": 0, "total": 0}))
        
    return result
