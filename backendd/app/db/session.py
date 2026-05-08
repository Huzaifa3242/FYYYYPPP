from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session

from app.core.config import settings



if not settings.DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg://")):
    raise RuntimeError("DATABASE_URL must use PostgreSQL. SQLite is not supported in this project.")


engine = create_engine(

    settings.DATABASE_URL,

)



def init_db() -> None:

    from app.models.user import User  # noqa: F401

    from app.models.chat import ChatThread, ChatMessage  # noqa: F401

    from app.models.report import AnalysisReport  # noqa: F401

    from app.models.training import TrainingAnswer  # noqa: F401

    SQLModel.metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE analysisreport ADD COLUMN IF NOT EXISTS llm_report TEXT"))



def get_session():

    with Session(engine) as session:

        yield session

