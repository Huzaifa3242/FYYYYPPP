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
    # Legacy global chat rows with NULL user_id are intentionally left inaccessible.
    threads = session.exec(
        select(ChatThread).where(ChatThread.user_id == current_user.id)
    ).all()
    for thread in threads:
        msgs = session.exec(
            select(ChatMessage)
            .where(ChatMessage.thread_id == thread.id)
            .where(ChatMessage.user_id == current_user.id)
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
    anomaly_rate = round((anomalies_count / total_count) * 100, 1) if total_count else 0
    
    return {
        "total_analyses": total_count,
        "anomalies_detected": anomalies_count,
        "normal_results": normal_count,
        "anomaly_rate": anomaly_rate,
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


@router.get("/me/reports")
def get_user_reports(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    reports = session.exec(
        select(AnalysisReport)
        .where(AnalysisReport.user_id == current_user.id)
        .order_by(AnalysisReport.created_at.desc())
    ).all()

    return reports


@router.get("/me/reports/{report_id}")
def get_user_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    report = session.exec(
        select(AnalysisReport)
        .where(AnalysisReport.id == report_id)
        .where(AnalysisReport.user_id == current_user.id)
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return report


@router.get("/me/intelligence")
def get_user_intelligence(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    reports = session.exec(
        select(AnalysisReport)
        .where(AnalysisReport.user_id == current_user.id)
        .order_by(AnalysisReport.created_at.desc())
    ).all()

    severity_weights = {
        "Explosion": 1.0,
        "Shooting": 1.0,
        "Arson": 0.9,
        "Assault": 0.85,
        "Abuse": 0.8,
        "Fighting": 0.75,
        "Arrest": 0.7,
        "Stealing": 0.65,
        "Shoplifting": 0.55,
    }

    class_counts = {}
    confidence_buckets = {
        "Low <70%": 0,
        "Medium 70-90%": 0,
        "High >90%": 0,
    }
    severity_queue = {
        "Critical": 0,
        "High": 0,
        "Medium": 0,
        "Low": 0,
    }
    latest_high_risk = None
    best_risk_score = -1
    total_confidence = 0
    confidence_count = 0
    total_footage_sec = 0
    llm_generated = 0

    for report in reports:
        class_name = "Normal" if report.top_class == "NormalVideosforEventRecognition" else report.top_class
        class_counts[class_name] = class_counts.get(class_name, 0) + 1

        confidence = report.confidence or 0
        total_confidence += confidence
        confidence_count += 1
        total_footage_sec += report.duration_sec or 0

        if confidence < 0.7:
            confidence_buckets["Low <70%"] += 1
        elif confidence < 0.9:
            confidence_buckets["Medium 70-90%"] += 1
        else:
            confidence_buckets["High >90%"] += 1

        if report.llm_report:
            llm_generated += 1

        if report.status == "abnormal":
            if class_name in {"Explosion", "Shooting"}:
                severity_queue["Critical"] += 1
            elif class_name in {"Arson", "Assault", "Abuse", "Fighting"}:
                severity_queue["High"] += 1
            elif class_name in {"Arrest", "Stealing"}:
                severity_queue["Medium"] += 1
            else:
                severity_queue["Low"] += 1

            risk_score = round((severity_weights.get(class_name, 0.5) * confidence) * 100, 1)
            if risk_score > best_risk_score:
                best_risk_score = risk_score
                latest_high_risk = {
                    "id": report.id,
                    "filename": report.filename,
                    "top_class": class_name,
                    "confidence": confidence,
                    "risk_score": risk_score,
                    "created_at": report.created_at,
                }

    total_reports = len(reports)

    return {
        "threat_distribution": [
            {"class_name": key, "count": value}
            for key, value in sorted(class_counts.items(), key=lambda item: item[1], reverse=True)
        ],
        "confidence_distribution": [
            {"bucket": key, "count": value}
            for key, value in confidence_buckets.items()
        ],
        "severity_queue": [
            {"severity": key, "count": value}
            for key, value in severity_queue.items()
        ],
        "avg_confidence": round((total_confidence / confidence_count) * 100, 1) if confidence_count else 0,
        "llm_coverage": round((llm_generated / total_reports) * 100, 1) if total_reports else 0,
        "llm_generated": llm_generated,
        "total_reports": total_reports,
        "total_footage_minutes": round(total_footage_sec / 60, 2),
        "latest_high_risk": latest_high_risk,
    }


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
