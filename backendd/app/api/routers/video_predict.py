from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from tempfile import NamedTemporaryFile
from pathlib import Path
import shutil
from sqlmodel import Session

from app.services.video_inference import run_video_inference
from app.services.llm_report import generate_anomaly_report
from app.services.session_store import create_session
from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.user import User
from app.models.report import AnalysisReport

router = APIRouter(prefix="/predict", tags=["prediction"])


@router.post("/video")
async def predict_video(
    file: UploadFile = File(...),
    conf_threshold: float = 0.7,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not file.filename.lower().endswith((".mp4", ".avi", ".mov", ".mkv")):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    try:
        # save to temp file
        suffix = Path(file.filename).suffix
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = Path(tmp.name)
            contents = await file.read()
            tmp.write(contents)

        # run inference
        result = run_video_inference(str(tmp_path), conf_threshold=conf_threshold)

        overall = result.get("overall_summary", {})
        status = overall.get("status")
        top_class = overall.get("top_class")
        confidence = overall.get("confidence")

        session_id = None
        llm_report = None

        if status == "abnormal" and top_class is not None and confidence is not None:
            # 1) yahin par LLM report banao
            llm_report = generate_anomaly_report(
                crime_label=top_class,
                confidence=confidence,
            )

            # 2) label + report dono session me save karo
            session_id = create_session(
                anomaly_label=top_class,
                anomaly_report=llm_report,
            )

        # 4) Save to Database for Dashboard
        report_record = AnalysisReport(
            user_id=current_user.id,
            filename=file.filename,
            status=status,
            top_class=top_class,
            confidence=confidence,
            duration_sec=result.get("duration_sec", 0),
        )
        session.add(report_record)
        session.commit()
        session.refresh(report_record)

        # 3) result me dono cheezen wapis bhejo
        result["llm_report"] = llm_report
        result["session_id"] = session_id

        return result
    finally:
        try:
            if "tmp_path" in locals() and tmp_path.exists():
                tmp_path.unlink()
        except Exception:
            pass