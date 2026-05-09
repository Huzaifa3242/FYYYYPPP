from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.core.config import settings
from app.db.session import init_db
from app.api.routers import health, auth, users
from app.api.routers import video_predict
from app.api.routers import report
from app.api.routers import chat
from app.api.routers import training

def create_app() -> FastAPI:
    app = FastAPI(title=settings.APP_NAME)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup():
        init_db()

    # Mount static files for training videos
    videos_path = Path(__file__).parent.parent / "videos"
    if videos_path.exists():
        app.mount("/training-videos", StaticFiles(directory=str(videos_path)), name="training-videos")

    explainability_frames_path = Path(__file__).parent.parent / "explainability_frames"
    explainability_frames_path.mkdir(parents=True, exist_ok=True)
    app.mount(
        "/explainability-frames",
        StaticFiles(directory=str(explainability_frames_path)),
        name="explainability-frames",
    )

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(video_predict.router, prefix="/api/v1")
    app.include_router(report.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(training.router, prefix="/api/v1")

    return app

app = create_app()