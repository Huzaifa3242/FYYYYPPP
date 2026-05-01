# app/api/routers/report.py

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.llm_report import generate_anomaly_report


class ReportRequest(BaseModel):
    top_class: str
    confidence: float


class ReportResponse(BaseModel):
    report: str


router = APIRouter(prefix="/report", tags=["report"])


@router.post("/anomaly", response_model=ReportResponse)
async def anomaly_report(data: ReportRequest):
    report_text = generate_anomaly_report(
        crime_label=data.top_class,
        confidence=data.confidence,
    )
    return ReportResponse(report=report_text)
