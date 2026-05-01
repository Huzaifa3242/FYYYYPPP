from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
)

def init_db() -> None:
    from app.models.user import User  # noqa: F401
    from app.models.chat import ChatThread, ChatMessage  # noqa: F401
    from app.models.report import AnalysisReport  # noqa: F401
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
