# app/services/session_store.py

from typing import Dict, Any
import uuid

_sessions: Dict[str, Dict[str, Any]] = {}


def create_session(anomaly_label: str, anomaly_report: str | None) -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "anomaly_label": anomaly_label,
        "anomaly_report": anomaly_report or "",
    }
    return session_id


def get_session(session_id: str) -> Dict[str, Any] | None:
    return _sessions.get(session_id)