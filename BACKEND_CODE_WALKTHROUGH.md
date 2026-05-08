# Backend Code Walkthrough

This document is a developer-facing walkthrough of the `FYYYYPPP` codebase, focused mainly on the active backend implementation in `backendd` and the way the frontend calls it.

The `backend` folder was intentionally not analyzed because the active/original backend for this project is `backendd`.

## Project purpose

The project is a security-focused video anomaly detection application named **SecureVision AI**.

At a high level, it lets users:

- **Register and log in** using email/password authentication.
- **Upload CCTV/security video files** for anomaly detection.
- **Run ML inference** over uploaded videos to classify the event type.
- **Detect abnormal/security events** such as arrest, assault, abuse, explosion, shoplifting, shooting, and related classes.
- **Generate an AI-written security report** for abnormal detections using Groq.
- **Store analysis metadata** in PostgreSQL for dashboard/reporting screens.
- **View dashboard analytics** based on stored analysis reports.
- **Use a chat assistant** backed by Groq streaming responses.
- **Use a training module** with curated local security videos and quiz-style questions.

The frontend lives in `Frontend`. The active backend lives in `backendd`.

## High-level architecture

The project is split into two main application parts:

- **Frontend:** `Frontend`
  - React application built with Vite.
  - Uses Vite dev-server proxy to forward `/api` and `/training-videos` requests to `http://localhost:8000`.
  - Main backend integrations are upload/prediction, auth, dashboard stats, reports, chat, training, and user settings.

- **Backend:** `backendd`
  - FastAPI application.
  - SQLModel/SQLAlchemy database access.
  - PostgreSQL-only database configuration.
  - JWT authentication with `python-jose`.
  - BCrypt password hashing.
  - PyTorch/TIMM/OpenCV video inference pipeline.
  - Groq integration for anomaly reports and streaming chat.
  - Static serving of local training videos from `backendd/videos`.

The backend follows a practical layered structure:

- **App startup:** `backendd/app/main.py`
- **Routers/controllers:** `backendd/app/api/routers/*.py`
- **Dependencies:** `backendd/app/api/deps.py`
- **Core config/security:** `backendd/app/core/*.py`
- **Database session/init:** `backendd/app/db/session.py`
- **SQLModel database tables:** `backendd/app/models/*.py`
- **Pydantic request/response schemas:** `backendd/app/schemas/*.py`
- **Service layer:** `backendd/app/services/*.py`
- **Local video assets:** `backendd/videos/*.mp4`
- **ML checkpoint:** `backendd/ucf_gru_model.pth`

## Backend folder structure overview

### `backendd/app/main.py`

This is the main FastAPI application entrypoint.

It is responsible for:

- Creating the `FastAPI` app.
- Enabling CORS for the Vite frontend at:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- Running database initialization during app startup.
- Mounting training videos at `/training-videos` if `backendd/videos` exists.
- Registering all API routers under `/api/v1`.

### `backendd/app/api`

This folder contains HTTP-layer code.

- **`deps.py`**
  - Shared FastAPI dependencies.
  - Defines JWT bearer-token extraction and current-user lookup.

- **`routers/auth.py`**
  - Registration and login endpoints.

- **`routers/users.py`**
  - Authenticated user profile, avatar, password, account deletion, report history, dashboard stats, trend, and intelligence analytics.

- **`routers/video_predict.py`**
  - Authenticated video upload and prediction endpoint.
  - Calls the ML inference service.
  - Calls the LLM report service for abnormal detections.
  - Writes an `AnalysisReport` database row.

- **`routers/report.py`**
  - Standalone endpoint to generate an anomaly report from a class/confidence pair.

- **`routers/chat.py`**
  - Chat thread/message CRUD.
  - Streams Groq chat completions as Server-Sent Events.

- **`routers/training.py`**
  - Static training scenarios.
  - Training session selection.
  - Answer submission.
  - Progress statistics.

- **`routers/health.py`**
  - Simple health check endpoint.

### `backendd/app/core`

Core app-wide utilities.

- **`config.py`**
  - Pydantic settings loaded from `.env`.
  - Holds database, JWT, Groq, Gemini fallback, and chat tuning settings.

- **`security.py`**
  - Password hashing/verification.
  - JWT access token creation.

### `backendd/app/db`

Database connection and initialization.

- **`session.py`**
  - Validates that `DATABASE_URL` is PostgreSQL.
  - Creates the SQLModel engine.
  - Creates tables at startup.
  - Adds `llm_report` column to `analysisreport` if missing.
  - Provides the `get_session()` dependency.

### `backendd/app/models`

SQLModel table definitions.

- **`user.py`**
  - User account table.

- **`report.py`**
  - Saved video analysis report table.

- **`chat.py`**
  - Chat threads and messages.

- **`training.py`**
  - Training answer attempts.

### `backendd/app/schemas`

Pydantic request/response models.

- **`auth.py`**
  - Token response schema.

- **`user.py`**
  - User create/login/read/update/password-change schemas.

- **`chat.py`**
  - Chat thread and chat message API shapes.

- **`training.py`**
  - Training scenario, question, answer, progress, and session schemas.

### `backendd/app/services`

Business logic and external integration code.

- **`model_loader.py`**
  - Defines the video classification model architecture.
  - Loads the ConvNeXtV2 feature extractor.
  - Loads the GRU classifier checkpoint.
  - Defines model labels/classes.

- **`video_inference.py`**
  - Handles video duration detection, frame extraction, frame preprocessing, feature extraction, temporal windowing, GRU prediction, anomaly segment extraction, and final response formatting.

- **`llm_report.py`**
  - Calls Groq to generate human-readable anomaly reports.

- **`session_store.py`**
  - In-memory session storage for anomaly label/report pairs.

### `backendd/videos`

Local MP4 training videos served by FastAPI at `/training-videos/{filename}`.

Current videos found:

- `backendd/videos/Abuse.mp4`
- `backendd/videos/Arrest.mp4`
- `backendd/videos/Assault.mp4`
- `backendd/videos/Explosion.mp4`
- `backendd/videos/Explosion2.mp4`
- `backendd/videos/Normal.mp4`
- `backendd/videos/Shooting.mp4`
- `backendd/videos/Shooting2.mp4`
- `backendd/videos/Shoplifting.mp4`

### Root-level backend utility files

- **`backendd/debug_reports.py`**
  - Opens a database session and prints `analysisreport` rows.
  - Useful as a manual debugging script.

- **`backendd/migrate_avatar.py`**
  - Manually adds `avatar_url` to the `user` table.
  - Uses a hardcoded PostgreSQL connection string.
  - This is useful historically, but risky for production because credentials and database location are embedded directly in the script.

- **`backendd/test.py`**
  - Manual script for calling `run_video_inference()` against a local video path.
  - The path currently points to an older-looking local folder and is not portable.

## Entry point and app startup flow

The backend starts from `backendd/app/main.py`.

Main flow:

1. `settings` is imported from `backendd/app/core/config.py`.
2. `init_db` is imported from `backendd/app/db/session.py`.
3. Routers are imported from `backendd/app/api/routers`.
4. `create_app()` constructs a `FastAPI` app with `title=settings.APP_NAME`.
5. CORS middleware is configured for the Vite frontend.
6. A startup handler calls `init_db()`.
7. Training videos are mounted if `backendd/videos` exists.
8. Routers are included under `/api/v1`.
9. The module-level `app = create_app()` exposes the ASGI application.

The usual server target would be the ASGI app path:

- `app.main:app`

The frontend expects this backend to be reachable on port `8000` because `Frontend/vite.config.js` proxies `/api` and `/training-videos` to `http://localhost:8000`.

## API routing overview

All routers are mounted with the prefix `/api/v1` in `backendd/app/main.py`.

### Health

Defined in `backendd/app/api/routers/health.py`.

- **`GET /api/v1/health`**
  - Returns `{ "status": "ok" }`.
  - No authentication required.

### Authentication

Defined in `backendd/app/api/routers/auth.py`.

- **`POST /api/v1/auth/register`**
  - Request schema: `UserCreate` from `backendd/app/schemas/user.py`.
  - Creates a new `User` row after checking email uniqueness.
  - Hashes the password with `hash_password()` from `backendd/app/core/security.py`.
  - Returns `UserRead`.

- **`POST /api/v1/auth/login`**
  - Request schema: `UserLogin`.
  - Looks up user by email.
  - Verifies password using BCrypt.
  - Returns `Token` with a JWT bearer token.

### Users, dashboard, and reports

Defined in `backendd/app/api/routers/users.py`.

All user endpoints use `get_current_user()` except the file does not define public routes.

- **`GET /api/v1/users/me`**
  - Returns the current authenticated user.

- **`PUT /api/v1/users/me`**
  - Updates `full_name`.

- **`PUT /api/v1/users/me/avatar`**
  - Accepts an uploaded image file.
  - Allows JPEG, PNG, GIF, and WebP.
  - Enforces max size of 800 KB.
  - Stores the avatar as a base64 `data:` URL in the `avatar_url` database column.

- **`PUT /api/v1/users/me/password`**
  - Verifies the current password.
  - Hashes and saves the new password.

- **`DELETE /api/v1/users/me`**
  - Deletes the current user.
  - Also deletes chat threads/messages, but because chat tables are not user-scoped, the current implementation deletes all chat threads and messages globally.
  - This is a significant data-isolation risk.

- **`GET /api/v1/users/me/stats`**
  - Computes dashboard totals from `AnalysisReport` rows for the current user.
  - Returns total analyses, abnormal count, normal count, and anomaly rate.

- **`GET /api/v1/users/me/activity?limit=5`**
  - Returns recent analysis reports for the user.

- **`GET /api/v1/users/me/reports`**
  - Returns all analysis reports for the user in newest-first order.

- **`GET /api/v1/users/me/reports/{report_id}`**
  - Returns one report if it belongs to the current user.

- **`GET /api/v1/users/me/intelligence`**
  - Aggregates report history into dashboard analytics:
    - Threat class distribution.
    - Confidence buckets.
    - Severity queue.
    - Average confidence.
    - LLM report coverage.
    - Total footage minutes.
    - Latest highest-risk event.

- **`GET /api/v1/users/me/trend`**
  - Builds a 7-day anomaly/total trend from recent reports.

### Video prediction

Defined in `backendd/app/api/routers/video_predict.py`.

- **`POST /api/v1/predict/video`**
  - Requires JWT authentication.
  - Accepts a multipart video upload named `file`.
  - Allows filename extensions:
    - `.mp4`
    - `.avi`
    - `.mov`
    - `.mkv`
  - Optional query parameter:
    - `conf_threshold`, default `0.7` at route level.
  - Saves the uploaded file to a temporary file.
  - Calls `run_video_inference()` from `backendd/app/services/video_inference.py`.
  - If result status is `abnormal`, calls `generate_anomaly_report()` from `backendd/app/services/llm_report.py`.
  - Creates an in-memory session with `create_session()` from `backendd/app/services/session_store.py`.
  - Saves an `AnalysisReport` row for dashboard/report pages.
  - Returns the full inference result plus `llm_report` and `session_id`.
  - Deletes the temporary uploaded file in a `finally` block.

### Standalone report generation

Defined in `backendd/app/api/routers/report.py`.

- **`POST /api/v1/report/anomaly`**
  - Accepts `top_class` and `confidence`.
  - Calls `generate_anomaly_report()`.
  - Returns `{ "report": "..." }`.
  - This route does not require authentication in the current code.
  - It does not write anything to the database.

### Chat

Defined in `backendd/app/api/routers/chat.py`.

- **`POST /api/v1/chat/threads`**
  - Creates a chat thread.
  - Returns thread metadata.

- **`GET /api/v1/chat/threads`**
  - Lists chat threads ordered by `updated_at` descending.
  - Includes last message text when available.

- **`GET /api/v1/chat/threads/{thread_id}`**
  - Returns one thread plus all its messages.

- **`DELETE /api/v1/chat/threads/{thread_id}`**
  - Deletes a thread and its messages.

- **`POST /api/v1/chat/threads/{thread_id}/messages`**
  - Adds the user message.
  - Builds recent chat context.
  - Sends a streaming Groq chat request.
  - Streams response chunks back to the frontend as Server-Sent Events.
  - Saves the completed assistant message to the database.

The chat routes currently do not require authentication and chat threads do not have a `user_id` field. That means chat history is global, not per-user.

### Training

Defined in `backendd/app/api/routers/training.py`.

- **`GET /api/v1/training/session?user_id=...&limit=3`**
  - Returns a training session containing selected scenarios.
  - If `user_id` is provided, it tries to prioritize scenarios not recently answered by that user.
  - `limit` is constrained from 1 to 5.

- **`POST /api/v1/training/answer`**
  - Records a classification answer for a scenario.
  - Checks selected label against the scenario's `correct_label`.
  - Saves a `TrainingAnswer` row.
  - Returns correctness, correct label, and a message.

- **`GET /api/v1/training/progress?user_id=...`**
  - Returns total attempts, correct attempts, accuracy, per-label stats, and recent scenario IDs.

- **`GET /api/v1/training/scenarios`**
  - Lists all available training scenarios.

Training routes currently accept `user_id` from query/body rather than deriving it from the authenticated JWT user.

## Detailed explanation of each backend module

## `backendd/app/main.py`

### What it is for

`main.py` is the FastAPI composition root. It wires together middleware, database startup, static file serving, and routers.

### Why it exists

FastAPI apps need a central ASGI app object. This file creates that object and makes all backend features available under a single HTTP service.

### Important behavior

- Creates the app with the configured title from `settings.APP_NAME`.
- Adds CORS for local Vite development.
- Calls `init_db()` during startup.
- Mounts local training videos at `/training-videos`.
- Includes all API routers with the `/api/v1` prefix.

### Connections to other modules

- Reads settings from `backendd/app/core/config.py`.
- Initializes database through `backendd/app/db/session.py`.
- Imports routers from `backendd/app/api/routers`.
- Serves files from `backendd/videos`.

### Risks and assumptions

- Static videos are mounted only if the folder exists.
- The path calculation depends on `main.py` staying under `backendd/app`.
- CORS currently allows only local Vite origins.

## `backendd/app/core/config.py`

### What it is for

This file defines environment-driven application settings using `pydantic-settings`.

### Key settings

- **Application:**
  - `APP_NAME`
  - `ENV`

- **Database:**
  - `DATABASE_URL`

- **Groq/report/chat:**
  - `GROQ_API_KEY`
  - `GROQ_MODEL`
  - `GROQ_TIMEOUT_SECONDS`
  - `GROQ_MAX_RETRIES`
  - `GROQ_MAX_COMPLETION_TOKENS`

- **Possible Gemini fallback settings:**
  - `CHAT_ENABLE_GEMINI_FALLBACK`
  - `GOOGLE_API_KEY`
  - `GOOGLE_MODEL`

- **Chat context tuning:**
  - `CHAT_CONTEXT_MESSAGES`
  - `CHAT_CONTEXT_MAX_CHARS`

- **JWT:**
  - `JWT_SECRET_KEY`
  - `JWT_ALG`
  - `ACCESS_TOKEN_EXPIRE_MINUTES`

### How it connects

- `settings.DATABASE_URL` is used by `backendd/app/db/session.py`.
- `settings.JWT_SECRET_KEY`, `JWT_ALG`, and token expiry are used by `backendd/app/core/security.py` and `backendd/app/api/deps.py`.
- `settings.GROQ_API_KEY` and chat options are used by `backendd/app/api/routers/chat.py` and `backendd/app/services/llm_report.py`.

### Risks and assumptions

- `DATABASE_URL` has no default and must be set.
- `JWT_SECRET_KEY` defaults to `CHANGE_ME`, which is unsafe outside local development.
- Gemini fallback settings exist, but the current chat route only requires/uses Groq. This part is unclear from the current code and may be leftover planned functionality.

## `backendd/app/core/security.py`

### What it is for

This module handles password and token security.

### Functions

- **`hash_password(pw: str) -> str`**
  - Generates a BCrypt salt.
  - Hashes the plaintext password.
  - Returns the hash as a string.

- **`verify_password(pw: str, hashed: str) -> bool`**
  - Checks plaintext password against stored BCrypt hash.

- **`create_access_token(subject: str) -> str`**
  - Creates a JWT containing:
    - `sub`: usually the user's email.
    - `exp`: expiration datetime.
  - Uses configured JWT secret and algorithm.

### How it connects

- Used by `auth.py` during registration and login.
- Used by `users.py` for password changes.
- Tokens are decoded by `deps.py`.

### Risks and assumptions

- The JWT subject is email, not user ID.
- If a user changes email in the future, existing tokens would no longer match unless token logic changes.
- Default `JWT_SECRET_KEY` should be replaced in `.env`.

## `backendd/app/db/session.py`

### What it is for

This module owns database engine creation, table initialization, and FastAPI database session dependency.

### Important behavior

- Requires `DATABASE_URL` to start with `postgresql://` or `postgresql+psycopg://`.
- Rejects SQLite explicitly.
- Creates the SQLModel engine.
- `init_db()` imports all models and creates tables.
- `init_db()` also runs a manual migration-like SQL statement to add `llm_report` to `analysisreport` if missing.
- `get_session()` yields a SQLModel `Session` to FastAPI route handlers.

### How it connects

- Called during startup from `main.py`.
- `get_session()` is injected into route handlers in `auth.py`, `users.py`, `video_predict.py`, `chat.py`, and `training.py`.

### Risks and assumptions

- The app uses automatic table creation, not a full migration tool such as Alembic.
- Only one manual schema evolution is handled: `analysisreport.llm_report`.
- Table naming uses SQLModel defaults, such as `analysisreport` and `chatthread`.

## `backendd/app/api/deps.py`

### What it is for

This file provides the shared authentication dependency `get_current_user()`.

### Flow

1. FastAPI extracts the bearer token using `OAuth2PasswordBearer`.
2. The token is decoded with `settings.JWT_SECRET_KEY` and `settings.JWT_ALG`.
3. The `sub` claim is read as the user email.
4. The database is queried for a `User` with that email.
5. If no user exists or `is_active` is false, a `401` is raised.
6. Otherwise the `User` object is returned to the route handler.

### How it connects

Used by:

- `backendd/app/api/routers/users.py`
- `backendd/app/api/routers/video_predict.py`

### Risks and assumptions

- Chat and training routes do not use this dependency, even though the frontend may send auth headers.
- Token URL points to `/api/v1/auth/login`.

## `backendd/app/api/routers/auth.py`

### What it is for

User account registration and login.

### Functions/endpoints

- **`register()`**
  - Checks whether email already exists.
  - Creates `User` with hashed password.
  - Commits and refreshes the user.
  - Returns safe user fields via `UserRead`.

- **`login()`**
  - Fetches user by email.
  - Returns `401` with `Please sign up` if user is missing.
  - Verifies password.
  - Returns JWT access token.

### Request flow

Frontend files:

- `Frontend/src/components/Signup/Signup.jsx` calls `POST /api/v1/auth/register`.
- `Frontend/src/components/Login/Login.jsx` calls `POST /api/v1/auth/login` and stores `access_token` in `localStorage`.

### Risks and assumptions

- Registration does not validate password strength in the backend schema.
- Login error reveals whether the email exists because missing user returns `Please sign up`.

## `backendd/app/api/routers/users.py`

### What it is for

This router handles authenticated user profile operations and dashboard/report analytics.

### Profile and account operations

- Returns current user.
- Updates name.
- Uploads avatar.
- Changes password.
- Deletes account.

### Dashboard/report operations

- Reads `AnalysisReport` rows belonging to the current user.
- Computes summary counts.
- Builds recent activity.
- Returns full report list and individual report detail.
- Builds intelligence analytics and trend charts.

### How requests are processed

For protected endpoints:

1. `get_current_user()` decodes JWT and loads the user.
2. `get_session()` provides a database session.
3. The endpoint reads/writes SQLModel objects.
4. The route returns either SQLModel objects directly or computed dictionaries/lists.

### Important business logic

- `get_user_stats()` counts all reports for the user and treats `status == "abnormal"` as anomaly.
- `get_user_intelligence()` maps analysis reports into dashboard visualizations:
  - Counts classes.
  - Buckets confidence into low/medium/high.
  - Assigns severity categories for abnormal reports.
  - Computes risk score using class severity weight times confidence.
  - Tracks LLM report coverage.
- `get_user_trend()` builds a 7-day trend using report timestamps.

### Frontend connections

- `Frontend/src/context/UserContext.jsx` calls `/api/v1/users/me`.
- `Frontend/src/components/Dashboard/Dashboard.jsx` calls:
  - `/api/v1/users/me/stats`
  - `/api/v1/users/me/activity`
  - `/api/v1/users/me/trend`
  - `/api/v1/users/me/intelligence`
- `Frontend/src/components/Reports/Reports.jsx` calls:
  - `/api/v1/users/me/reports`
  - `/api/v1/users/me/reports/{report_id}`
- `Frontend/src/components/Settings/Settings.jsx` calls:
  - `/api/v1/users/me`
  - `/api/v1/users/me/avatar`
  - `/api/v1/users/me/password`
  - `DELETE /api/v1/users/me`

### Risks and assumptions

- `delete_account()` deletes all chat threads/messages globally because chat is not user-scoped.
- `get_user_intelligence()` contains references to legacy/alternate label `NormalVideosforEventRecognition`, but the current backend model labels use `Normal`.
- Some date handling normalizes timezone-aware datetimes to naive datetimes for comparison.

## `backendd/app/api/routers/video_predict.py`

### What it is for

This is the main ML prediction API controller. It accepts uploaded videos and orchestrates inference, report generation, session storage, and database writes.

### Endpoint

- `POST /api/v1/predict/video`

### Flow

1. Requires authenticated user with `get_current_user()`.
2. Validates the uploaded filename extension.
3. Reads the upload into a temporary file.
4. Calls `run_video_inference()`.
5. Extracts `overall_summary.status`, `top_class`, and `confidence`.
6. If abnormal:
   - Calls `generate_anomaly_report()`.
   - Stores anomaly label/report in in-memory `session_store`.
7. Creates an `AnalysisReport` database row.
8. Adds `llm_report` and `session_id` to the response payload.
9. Deletes temporary file in `finally`.

### How it connects

- Uses `backendd/app/services/video_inference.py` for ML inference.
- Uses `backendd/app/services/llm_report.py` for human-readable report generation.
- Uses `backendd/app/services/session_store.py` for temporary in-memory anomaly context.
- Writes `AnalysisReport` from `backendd/app/models/report.py`.
- Frontend upload UI calls it from `Frontend/src/components/Upload/Upload.jsx`.

### Response shape

The response comes mainly from `run_video_inference()` and includes:

- `video_path`
- `duration_sec`
- `chunk_seconds`
- `chunks`
  - `chunk_index`
  - `start_time_sec`
  - `duration_sec`
  - `overall`
    - `top_class`
    - `confidence`
  - `segments`
    - `class_name`
    - `confidence`
    - `start_time_sec`
    - `end_time_sec`
- `overall_summary`
  - `top_class`
  - `confidence`
  - `status`
- `llm_report`
- `session_id`

### Important inconsistency

The route generates `llm_report` and returns it to the frontend, but the `AnalysisReport` database record is created without setting `llm_report=llm_report`.

Because of that:

- The upload response can show an LLM report immediately.
- Later report pages may show no LLM report for that saved analysis.
- Dashboard LLM coverage can stay lower than expected.

This looks like visible technical debt or a bug.

## `backendd/app/api/routers/report.py`

### What it is for

This route exposes report generation separately from video upload.

### Endpoint

- `POST /api/v1/report/anomaly`

### Flow

1. Receives `top_class` and `confidence`.
2. Calls `generate_anomaly_report()`.
3. Returns the generated text.

### How it connects

- Uses `backendd/app/services/llm_report.py`.

### Risks and assumptions

- The endpoint is unauthenticated.
- The generated report is not stored.
- The main upload flow already generates reports for abnormal detections, so this route may be for testing or manual regeneration.

## `backendd/app/api/routers/chat.py`

### What it is for

This router implements the AI assistant. It stores chat history in PostgreSQL and streams assistant responses from Groq to the frontend.

### Internal helper functions

- **`_utc_now()`**
  - Returns timezone-aware UTC datetime.

- **`_require_groq_key()`**
  - Checks that `GROQ_API_KEY` exists.
  - Currently not used by the route; `_require_any_chat_provider()` is used instead.

- **`_require_any_chat_provider()`**
  - Currently requires `GROQ_API_KEY`.
  - Name suggests future multi-provider support, but current code only works with Groq.

- **`_trim_messages_for_context()`**
  - Limits how much old chat content is passed to the LLM.
  - Uses `CHAT_CONTEXT_MAX_CHARS` and `CHAT_CONTEXT_MESSAGES`.

- **`_sanitize_identity_claims()`**
  - Rewrites model text if it claims to be Google/Gemini or denies Groq identity.
  - Forces assistant identity toward SecureVision AI powered by Groq.

- **`_sanitize_stream_delta()`**
  - Sanitizes individual streaming chunks for provider identity terms.

- **`_thread_to_read()`**
  - Converts a `ChatThread` plus last message text into `ChatThreadRead` schema.

### Chat storage model

- `ChatThread` stores `title`, `created_at`, and `updated_at`.
- `ChatMessage` stores `thread_id`, `role`, `content`, and `created_at`.

### Streaming message flow

For `POST /api/v1/chat/threads/{thread_id}/messages`:

1. Validate Groq key exists.
2. Load the target thread.
3. Save the user's message in the database.
4. Update thread title if it is blank.
5. Load recent messages for context.
6. Trim older messages.
7. Build a system prompt for a concise security/crime-prevention assistant.
8. Create a Groq streaming chat completion.
9. Yield SSE events:
   - `ping` to make the client start rendering.
   - `meta` when first provider chunk is available.
   - default data messages with `{ "delta": "..." }`.
   - `error` if Groq fails or returns nothing.
   - `done` with the final full assistant content.
10. Save the final assistant message and update the thread timestamp.

### Frontend connection

`Frontend/src/components/Chat/Chat.jsx` calls:

- `GET /api/v1/chat/threads`
- `GET /api/v1/chat/threads/{thread_id}`
- `POST /api/v1/chat/threads`
- `DELETE /api/v1/chat/threads/{thread_id}`
- `POST /api/v1/chat/threads/{thread_id}/messages`

The frontend reads the streamed SSE-like response using `response.body.getReader()`.

### Risks and assumptions

- Chat routes are not authenticated.
- Chat data is not tied to users.
- `CHAT_ENABLE_GEMINI_FALLBACK`, `GOOGLE_API_KEY`, and `GOOGLE_MODEL` exist in config, but no actual Gemini fallback is implemented in the current chat router.
- The route uses a SQLModel session inside the streaming generator. This usually works for simple local usage, but long-running streaming responses can make DB session lifetime more sensitive.

## `backendd/app/api/routers/training.py`

### What it is for

This router implements the training module. It serves curated scenario metadata and records quiz/classification progress.

### Scenario data

The file contains a hardcoded list named `TRAINING_SCENARIOS`.

Each scenario includes:

- `id`
- `title`
- `description`
- `video_filename`
- `correct_label`
- `options`
- `questions`

Each scenario currently has three questions:

- Event classification.
- Threat level.
- Recommended response.

### Scenario/video mapping

The scenario list is intentionally based on files in `backendd/videos`:

- `Abuse` uses `Abuse.mp4`
- `Arrest` uses `Arrest.mp4`
- `Assault` uses `Assault.mp4`
- `Explosion` uses `Explosion.mp4`
- `Explosion2` uses `Explosion2.mp4`
- `Normal` uses `Normal.mp4`
- `Shooting` uses `Shooting.mp4`
- `Shooting2` uses `Shooting2.mp4`
- `Shoplifting` uses `Shoplifting.mp4`

### Main functions/endpoints

- **`get_training_session()`**
  - Returns a randomized session of scenarios.
  - If `user_id` is supplied, the backend looks at recent answers and tries to prefer unseen scenarios.
  - Uses `random.shuffle()` or `random.sample()`.

- **`submit_answer()`**
  - Finds scenario by `scenario_id`.
  - Compares `selected_label` against `scenario.correct_label`.
  - Saves a `TrainingAnswer` row.
  - Returns correctness and feedback.

- **`get_progress()`**
  - Loads all answers for `user_id`.
  - Calculates total attempts, correct attempts, accuracy, per-label accuracy, and recent scenario IDs.

- **`list_all_scenarios()`**
  - Returns every scenario.

### Frontend connection

`Frontend/src/components/Training/Training.jsx` calls:

- `GET /api/v1/training/session?limit=3&user_id=...`
- `GET /api/v1/training/progress?user_id=...`
- `POST /api/v1/training/answer`
- Static video URLs under `/training-videos/{filename}`

### Important behavior mismatch

The backend `submit_answer()` checks only `selected_label` against the scenario-level `correct_label`.

The frontend displays three questions per scenario, but only posts to `/training/answer` for the first question. For the second and third questions, correctness is checked locally in the frontend.

That means backend progress tracks classification attempts only, not all three question answers.

### Risks and assumptions

- Training routes are not authenticated even though the frontend sends auth headers.
- `user_id` can be any string supplied by the client.
- Scenarios are hardcoded in Python, not in a database/config file.
- Adding/removing videos requires keeping `backendd/videos` and `TRAINING_SCENARIOS` synchronized manually.

## `backendd/app/api/routers/health.py`

### What it is for

A minimal health endpoint for confirming the backend is running.

### Endpoint

- `GET /api/v1/health`

### Behavior

Returns a simple OK response.

## Services layer explained in depth

## `backendd/app/services/model_loader.py`

### Purpose

This file centralizes model definitions and model loading for the video anomaly detection pipeline.

### Why it exists

Video inference needs two model components:

- A visual feature extractor for individual frames.
- A temporal classifier for sequences of frame embeddings.

Keeping those in `model_loader.py` avoids recreating them for every helper function.

### Important constants

- **`DEVICE`**
  - Uses `cuda` if available, otherwise `cpu`.

- **`CLASS_NAMES`**
  - The model output index-to-label mapping:
    - `Normal`
    - `Arrest`
    - `Assault`
    - `Stealing`
    - `Arson`
    - `Abuse`
    - `Fighting`
    - `Explosion`
    - `Shoplifting`
    - `Shooting`

- **`IMG_SIZE`**
  - `224`.

- **`INPUT_DIM`**
  - `768`, matching ConvNeXtV2 tiny feature output.

### `GRUClassifier`

This is the temporal classification model.

- Input shape assumption: batch of sequences shaped like `[B, T, D]`.
- `B`: batch size.
- `T`: time/window length.
- `D`: frame embedding dimension, expected `768`.
- Uses a 2-layer bidirectional GRU.
- Applies dropout.
- Uses a final linear layer to produce logits over `len(CLASS_NAMES)` classes.
- Takes the output at the final time step.

### `get_feature_extractor()`

This function is cached with `lru_cache(maxsize=1)`.

It:

- Creates a TIMM model named `convnextv2_tiny`.
- Uses pretrained weights.
- Removes classification head with `num_classes=0`.
- Uses global average pooling.
- Moves the model to `DEVICE`.
- Sets it to eval mode.
- Builds the image transform:
  - Resize to 256.
  - Center crop to 224.
  - Convert to tensor.
  - Normalize with ImageNet mean/std.

### `get_gru_model()`

This function is also cached.

It:

- Looks for `ucf_gru_model.pth` by default.
- Creates `GRUClassifier()`.
- Loads the checkpoint with `torch.load()`.
- Supports checkpoint files saved either as a raw state dict or as `{ "model_state_dict": ... }`.
- Loads weights and sets eval mode.

### Important assumption

`get_gru_model()` uses a relative default checkpoint path: `ucf_gru_model.pth`.

That works if the backend process is started with `backendd` as the current working directory. If the server is started from another folder, model loading may fail because the checkpoint path will resolve relative to the process working directory, not necessarily relative to this file.

## `backendd/app/services/video_inference.py`

### Purpose

This is the main video preprocessing and inference pipeline.

It converts an uploaded video file into:

- Overall classification.
- Per-chunk classification.
- Timed anomaly segments.
- Duration metadata.

### Key constants

- **`FPS = 2`**
  - Extracts two frames per second from video.

- **`WINDOW_SIZE = 32`**
  - Temporal classifier receives 32-frame embedding windows.

- **`STRIDE = 16`**
  - Sliding windows overlap by half.

- **`CHUNK_MINUTES = 30`**
  - Long videos are processed in 30-minute chunks.

- **`TMP_FRAMES_DIR = Path("tmp_frames")`**
  - Temporary extracted frames are stored in a relative folder named `tmp_frames`.

### `get_video_duration_sec(path)`

Uses OpenCV to:

- Open the video.
- Read FPS.
- Read total frame count.
- Return duration as `frame_count / fps`.

If the video cannot be opened, it raises a runtime error.

### `extract_frames_for_chunk(video_path, start_sec, duration_sec, fps)`

Uses `ffmpeg` through `subprocess.run()` to extract frames.

The command:

- Seeks to `start_sec`.
- Reads `duration_sec` seconds.
- Extracts frames at `fps=2`.
- Saves frames under `tmp_frames/frame_XXXXX.png`.

Important behavior:

- Deletes any existing `tmp_frames` directory before extraction.
- Suppresses ffmpeg stdout/stderr.
- Uses `check=False`, so ffmpeg failure does not directly raise an exception.
- Returns all extracted frame paths it finds.

### `FrameDataset`

A PyTorch dataset for extracted image frames.

For each frame:

- Reads with OpenCV.
- If OpenCV returns `None`, substitutes a black image.
- Converts BGR to RGB.
- Converts to PIL image.
- Applies the feature extractor transform from `model_loader.py`.

### `frames_to_embeddings(frame_paths)`

This function:

1. Builds `FrameDataset`.
2. Uses a PyTorch `DataLoader`.
3. Runs the ConvNeXtV2 feature extractor in `torch.no_grad()` mode.
4. Collects output embeddings as NumPy arrays.
5. Returns shape roughly `[num_frames, 768]`.

If there are no frames, returns an empty `(0, 768)` array.

### `make_windows(embs)`

This function converts frame embeddings into GRU-ready windows.

Cases:

- If there are zero embeddings, returns `(0, 32, 768)`.
- If fewer than 32 embeddings exist, repeats the last embedding until the sequence has 32 frames.
- If 32 or more embeddings exist, creates sliding windows with stride 16.

The output shape is approximately:

- `[num_windows, 32, 768]`

### `predict_windows(windows)`

This function:

1. Loads the cached GRU model.
2. Batches window tensors.
3. Runs the model in no-grad mode.
4. Applies softmax over class logits.
5. Returns probabilities shaped `[num_windows, num_classes]`.

### `collect_anomaly_segments(window_probs, fps, threshold)`

This function turns window-level predictions into time-based anomaly segments.

For each predicted window:

- Finds the highest-probability class.
- Skips if the class is `Normal`.
- Skips if confidence is below threshold.
- Converts the window index into start/end seconds.
- Returns segment dictionaries with class, confidence, and time range.

Because `FPS = 2` and `WINDOW_SIZE = 32`, each window covers about 16 seconds of extracted video time.

### `run_video_inference(video_path, conf_threshold)`

This is the public service function called by the prediction router.

End-to-end flow:

1. Determine full video duration.
2. Split the video into 30-minute chunks.
3. For each chunk:
   - Extract frames with ffmpeg.
   - Convert frames to ConvNeXt embeddings.
   - Make GRU temporal windows.
   - Predict class probabilities per window.
   - Average probabilities to get chunk-level classification.
   - Collect anomaly segments above threshold.
   - Shift segment times by chunk start time.
4. Build a global summary by choosing the chunk with the highest confidence.
5. Mark status as:
   - `normal` if top class is `Normal`.
   - `abnormal` otherwise.
   - `unknown` if no chunks exist.
6. Delete `tmp_frames`.
7. Return the result dictionary.

### Important assumptions and risks

- Requires `ffmpeg` to be installed and available on PATH.
- Uses a shared relative `tmp_frames` folder. Concurrent prediction requests can interfere with each other because one request may delete another request's frames.
- Uses `check=False` for ffmpeg, so extraction failures can become empty-frame results rather than immediate clear errors.
- Global summary chooses the chunk with highest confidence, regardless of whether it is normal or abnormal. A highly confident normal chunk could dominate over a lower-confidence abnormal chunk. The comment says “pick chunk with highest confidence abnormal class, else normal,” but the code actually chooses the highest confidence chunk overall.
- Model checkpoint loading depends on the current working directory because the default checkpoint path is relative.

## `backendd/app/services/llm_report.py`

### Purpose

This service generates a readable security explanation for abnormal detections.

### Function

- **`generate_anomaly_report(crime_label: str, confidence: float) -> str`**

### Flow

1. Reads `settings.GROQ_API_KEY`.
2. If no key exists, returns a warning string instead of raising.
3. Creates a Groq client.
4. Builds a prompt containing:
   - Predicted crime type.
   - Model confidence.
   - Instructions to explain what the crime looks like, why it is dangerous, and prevention/reduction steps.
5. Calls Groq chat completions with model `llama-3.3-70b-versatile`.
6. Returns the assistant message content.

### How it connects

Used by:

- `backendd/app/api/routers/video_predict.py`
- `backendd/app/api/routers/report.py`

### Risks and assumptions

- Uses hardcoded model `llama-3.3-70b-versatile` instead of `settings.GROQ_MODEL`.
- If Groq call fails, there is no local try/except in this service.
- The upload route will fail if Groq raises during abnormal report generation.
- Missing API key returns a warning string, which may be stored/returned as if it were a report.

## `backendd/app/services/session_store.py`

### Purpose

Stores anomaly session metadata in memory.

### Functions

- **`create_session(anomaly_label, anomaly_report)`**
  - Generates a UUID string.
  - Saves anomaly label and report in a module-level dictionary.
  - Returns the session ID.

- **`get_session(session_id)`**
  - Reads a session by ID.

### How it connects

`video_predict.py` creates a session when an abnormal detection occurs.

### Important limitation

No route currently appears to read from `session_store.get_session()`.

This part is unclear from the current code. It may be leftover from a planned chat/report context flow, but in the analyzed files there is no endpoint that consumes the generated `session_id`.

### Risks

- Data disappears when the backend process restarts.
- Data is not shared across multiple workers/processes.
- There is no expiry/cleanup.
- It is not tied to authenticated users.

## Model / ML inference flow explained step by step

The ML pipeline lives mainly in:

- `backendd/app/services/model_loader.py`
- `backendd/app/services/video_inference.py`
- `backendd/ucf_gru_model.pth`

### Step 1: Upload enters the prediction endpoint

The frontend sends a video file to:

- `POST /api/v1/predict/video`

The backend receives it in `video_predict.py` as `UploadFile`.

### Step 2: File validation

The route checks the filename extension.

Allowed extensions:

- `.mp4`
- `.avi`
- `.mov`
- `.mkv`

This is extension-based validation only. It does not inspect actual video container content.

### Step 3: Temporary file storage

The route writes the uploaded bytes to a `NamedTemporaryFile` with the original suffix.

This temporary video file is what the inference service reads.

### Step 4: Video duration calculation

`run_video_inference()` calls `get_video_duration_sec()`.

OpenCV reads:

- FPS.
- Frame count.

Duration is calculated as frame count divided by FPS.

### Step 5: Chunking

The video is split into chunks of 30 minutes.

For normal short videos, this results in one chunk.

### Step 6: Frame extraction

For each chunk, `extract_frames_for_chunk()` calls `ffmpeg` and extracts frames at `FPS = 2`.

Frames are written to:

- `tmp_frames/frame_00001.png`
- `tmp_frames/frame_00002.png`
- etc.

### Step 7: Image preprocessing

Each extracted frame is loaded by `FrameDataset`.

Preprocessing:

- OpenCV reads image.
- BGR is converted to RGB.
- Image is converted to PIL.
- Transform pipeline resizes, center-crops, converts to tensor, and normalizes with ImageNet stats.

### Step 8: Feature extraction

`frames_to_embeddings()` loads the cached ConvNeXtV2 tiny feature extractor from `get_feature_extractor()`.

The extractor:

- Uses pretrained weights.
- Outputs a 768-dimensional embedding per frame.

The result is a NumPy array shaped like:

- `[num_frames, 768]`

### Step 9: Temporal window creation

`make_windows()` converts frame embeddings into temporal windows.

Each window contains:

- 32 frame embeddings.

Each embedding has:

- 768 dimensions.

So each window has shape:

- `[32, 768]`

The batch of windows has shape:

- `[num_windows, 32, 768]`

### Step 10: GRU classification

`predict_windows()` loads `GRUClassifier` weights from:

- `backendd/ucf_gru_model.pth`

The GRU outputs logits for the classes in `CLASS_NAMES`.

Softmax converts logits to probabilities.

### Step 11: Class mapping

The probability index is mapped using `CLASS_NAMES`:

- Index 0: `Normal`
- Index 1: `Arrest`
- Index 2: `Assault`
- Index 3: `Stealing`
- Index 4: `Arson`
- Index 5: `Abuse`
- Index 6: `Fighting`
- Index 7: `Explosion`
- Index 8: `Shoplifting`
- Index 9: `Shooting`

### Step 12: Chunk classification

For each chunk:

- Window probabilities are averaged.
- The highest average probability becomes the chunk `top_class`.
- The value of that probability becomes chunk `confidence`.

### Step 13: Segment extraction

`collect_anomaly_segments()` checks each temporal window.

A segment is returned only when:

- Predicted class is not `Normal`.
- Confidence is greater than or equal to `conf_threshold`.

Each segment includes:

- `class_name`
- `confidence`
- `start_time_sec`
- `end_time_sec`

### Step 14: Overall summary

After all chunks are processed, the code chooses the chunk classification with the highest confidence and returns it as `overall_summary`.

Status is set as:

- `normal` when `top_class == "Normal"`
- `abnormal` for any other class
- `unknown` if no chunks exist

### Step 15: LLM report generation

If status is `abnormal`, `video_predict.py` calls `generate_anomaly_report()`.

That sends class/confidence context to Groq and returns a readable security report.

### Step 16: Database record

The route saves an `AnalysisReport` row with:

- user ID
- filename
- status
- top class
- confidence
- duration

Current code does not persist the generated `llm_report` field even though the model contains it.

### Step 17: Response returned

The frontend receives:

- ML result.
- Chunks and segments.
- Overall summary.
- LLM report if abnormal.
- Session ID if abnormal.

## Data flow: request -> processing -> response

## Prediction data flow

1. `Frontend/src/components/Upload/Upload.jsx` sends an authenticated multipart upload to `/api/v1/predict/video`.
2. `video_predict.py` validates the file extension.
3. The upload is written to a temporary video file.
4. `run_video_inference()` analyzes the video.
5. `video_inference.py` extracts frames with ffmpeg.
6. Frames are converted to embeddings using ConvNeXtV2.
7. Embeddings are grouped into temporal windows.
8. GRU model classifies each window.
9. Chunk and overall results are calculated.
10. If abnormal, `llm_report.py` generates a Groq report.
11. `video_predict.py` saves an `AnalysisReport` row.
12. Response is returned to frontend.
13. Temporary uploaded file and extracted frames are cleaned up.

## Dashboard/report data flow

1. A prediction request creates `AnalysisReport` rows.
2. Dashboard calls user endpoints in `users.py`.
3. `users.py` queries `AnalysisReport` by `current_user.id`.
4. Backend computes totals, trend, severity, and distribution data.
5. Frontend renders cards/charts/reports.

## Chat data flow

1. `Frontend/src/components/Chat/Chat.jsx` creates or selects a thread.
2. User sends a message to `/api/v1/chat/threads/{thread_id}/messages`.
3. Backend saves the user message.
4. Backend loads recent context.
5. Backend streams Groq output to the frontend.
6. Frontend appends streamed deltas to the message bubble.
7. Backend saves the final assistant message.

## Training data flow

1. `Frontend/src/components/Training/Training.jsx` requests a training session.
2. `training.py` selects scenario objects from hardcoded `TRAINING_SCENARIOS`.
3. Frontend displays scenario metadata and streams video from `/training-videos/{filename}`.
4. User answers questions.
5. For the first classification question, frontend posts selected label to `/api/v1/training/answer`.
6. Backend saves a `TrainingAnswer` row.
7. Frontend asks `/api/v1/training/progress` to refresh progress stats.

## Database/models/schemas explanation

## Database engine and startup

Database setup is in `backendd/app/db/session.py`.

The backend expects PostgreSQL only. If `DATABASE_URL` is SQLite or missing an accepted PostgreSQL prefix, startup fails.

Tables are created automatically using:

- `SQLModel.metadata.create_all(engine)`

## `User` model

Path: `backendd/app/models/user.py`

Fields:

- `id`: primary key.
- `email`: unique and indexed.
- `full_name`: optional display name.
- `hashed_password`: BCrypt hash.
- `avatar_url`: optional base64 data URL.
- `created_at`: timezone-aware datetime by default.
- `is_active`: boolean flag.

Used by:

- Auth registration/login.
- Current-user dependency.
- Profile/settings routes.
- Prediction report ownership.

Related schemas in `backendd/app/schemas/user.py`:

- `UserCreate`
- `UserRead`
- `UserLogin`
- `UserUpdate`
- `PasswordChange`

## `AnalysisReport` model

Path: `backendd/app/models/report.py`

Fields:

- `id`: primary key.
- `user_id`: foreign key to `user.id`.
- `filename`: uploaded file name.
- `status`: expected `normal` or `abnormal`.
- `top_class`: predicted class.
- `confidence`: predicted confidence.
- `duration_sec`: analyzed video duration.
- `llm_report`: optional LLM report text.
- `created_at`: timestamp.

Used by:

- Prediction route writes it.
- Dashboard stats read it.
- Reports page reads it.
- Intelligence/trend analytics read it.

Important issue:

- `llm_report` exists in the model, but `video_predict.py` does not currently save generated LLM text into this field.

## `ChatThread` and `ChatMessage` models

Path: `backendd/app/models/chat.py`

`ChatThread` fields:

- `id`
- `title`
- `created_at`
- `updated_at`

`ChatMessage` fields:

- `id`
- `thread_id`
- `role`
- `content`
- `created_at`

Used by:

- Chat router.
- User account deletion cleanup.

Important issue:

- No `user_id` exists on chat threads/messages. Chat data is global.

Related schemas in `backendd/app/schemas/chat.py`:

- `ChatThreadCreate`
- `ChatThreadRead`
- `ChatMessageRead`
- `ChatThreadDetail`
- `ChatMessageCreate`

## `TrainingAnswer` model

Path: `backendd/app/models/training.py`

Fields:

- `id`: primary key.
- `user_id`: string, can be email or arbitrary user ID.
- `scenario_id`: scenario identifier like `Abuse` or `Shooting2`.
- `selected_label`: user-selected answer.
- `is_correct`: backend-computed correctness.
- `timestamp`: timestamp.

Used by:

- Training session personalization.
- Training answer recording.
- Training progress stats.

Related schemas in `backendd/app/schemas/training.py`:

- `Question`
- `TrainingScenario`
- `AnswerSubmit`
- `AnswerResult`
- `PerLabelStat`
- `ProgressStats`
- `TrainingSession`

## Config/environment variables explanation

Settings are loaded in `backendd/app/core/config.py` from environment variables and `.env`.

### Required

- **`DATABASE_URL`**
  - Required by `Settings`.
  - Must be PostgreSQL:
    - `postgresql://...`
    - `postgresql+psycopg://...`

### Strongly recommended

- **`JWT_SECRET_KEY`**
  - Used to sign and verify JWTs.
  - Defaults to `CHANGE_ME`, which should not be used outside development.

### Authentication/token settings

- **`JWT_ALG`**
  - Defaults to `HS256`.

- **`ACCESS_TOKEN_EXPIRE_MINUTES`**
  - Defaults to `60`.

### Groq/report/chat settings

- **`GROQ_API_KEY`**
  - Needed for Groq report generation and chat.
  - If absent:
    - Chat routes raise a `500`.
    - Report generation service returns a warning string instead of a real report.

- **`GROQ_MODEL`**
  - Used by chat router.
  - Defaults to `qwen/qwen3-32b`.

- **`GROQ_TIMEOUT_SECONDS`**
  - Chat client timeout.

- **`GROQ_MAX_RETRIES`**
  - Chat client retry count.

- **`GROQ_MAX_COMPLETION_TOKENS`**
  - Chat response token cap.

### Chat context settings

- **`CHAT_CONTEXT_MESSAGES`**
  - Number of recent messages to send to the chat provider.

- **`CHAT_CONTEXT_MAX_CHARS`**
  - Character trimming limit for old context messages.

### Gemini-related settings

- **`CHAT_ENABLE_GEMINI_FALLBACK`**
- **`GOOGLE_API_KEY`**
- **`GOOGLE_MODEL`**

These exist in config, but current analyzed chat code does not implement an actual Gemini fallback. This part is unclear from the current code and appears to be planned or leftover configuration.

## Static assets and videos handling

Static training videos live in:

- `backendd/videos`

`backendd/app/main.py` calculates:

- `Path(__file__).parent.parent / "videos"`

Since `main.py` is under `backendd/app`, this resolves to:

- `backendd/videos`

If that folder exists, FastAPI mounts it as:

- `/training-videos`

So a video such as:

- `backendd/videos/Shooting.mp4`

is served at:

- `/training-videos/Shooting.mp4`

The frontend uses this in `Frontend/src/components/Training/Training.jsx` by building video URLs as:

- `/training-videos/${filename}`

The Vite proxy in `Frontend/vite.config.js` forwards `/training-videos` to `http://localhost:8000` during local development.

## Training module flow

The training module is mostly backend-driven for scenario metadata and progress, but frontend-driven for multi-question UI behavior.

### Backend scenario definition

`backendd/app/api/routers/training.py` defines all scenarios as Python objects.

Each scenario references one local video file and contains three questions.

### Session selection

When the frontend requests a session:

- `GET /api/v1/training/session?limit=3&user_id=...`

The backend:

1. Copies all hardcoded scenarios into a list.
2. If `user_id` exists, queries the last 20 training answers.
3. Splits scenarios into unseen and seen.
4. Shuffles both groups.
5. Prefers unseen scenarios.
6. Returns up to `limit` scenarios.

### Video playback

Frontend receives `video_filename` and renders:

- `/training-videos/{video_filename}`

FastAPI serves the video file from `backendd/videos`.

### Answer submission

Frontend posts to backend only for the first/classification question of each scenario.

Payload:

- `user_id`
- `scenario_id`
- `selected_label`

Backend compares `selected_label` to `scenario.correct_label` and stores the result in `TrainingAnswer`.

### Progress tracking

Progress endpoint:

- `GET /api/v1/training/progress?user_id=...`

Backend computes:

- Total attempts.
- Correct attempts.
- Accuracy percentage.
- Per-label stats.
- Recent scenario IDs.

### Important assumptions

- The backend stores classification progress only.
- Threat-level and response-action answers are checked in the frontend but not persisted.
- Training users are identified by a client-supplied string, commonly email from frontend user context.

## Error handling and validation

### FastAPI/Pydantic validation

Request bodies using Pydantic schemas are validated automatically.

Examples:

- Email fields use `EmailStr` in user schemas.
- Training `limit` uses FastAPI `Query` constraints from 1 to 5.

### Explicit HTTP errors

The backend raises `HTTPException` in many cases:

- Duplicate email on register.
- Missing user on login.
- Invalid password.
- Invalid/inactive JWT user.
- Unsupported avatar type.
- Avatar too large.
- Incorrect current password.
- Missing report.
- Unsupported video type.
- Missing chat thread.
- Missing Groq API key for chat.
- Missing training scenario.

### Cleanup behavior

Prediction route uses a `finally` block to delete the uploaded temporary video file.

`run_video_inference()` deletes `tmp_frames` at the end of processing.

### Error-handling gaps

- `video_predict.py` does not catch exceptions from `run_video_inference()` or `generate_anomaly_report()`. FastAPI will return a server error if these fail.
- `llm_report.py` returns a warning for missing API key but does not catch Groq API failures.
- `extract_frames_for_chunk()` suppresses ffmpeg output and does not fail fast when ffmpeg fails.
- Shared `tmp_frames` can cause cleanup conflicts under concurrent requests.

## External integrations and dependencies

### FastAPI

Used as the HTTP API framework.

Key files:

- `backendd/app/main.py`
- `backendd/app/api/routers/*.py`

### SQLModel / SQLAlchemy / PostgreSQL

Used for database models, sessions, and persistence.

Key files:

- `backendd/app/db/session.py`
- `backendd/app/models/*.py`

### JWT and BCrypt

Used for authentication.

Key files:

- `backendd/app/core/security.py`
- `backendd/app/api/deps.py`

### PyTorch, TIMM, TorchVision, OpenCV, PIL, NumPy

Used for video inference.

Key files:

- `backendd/app/services/model_loader.py`
- `backendd/app/services/video_inference.py`

### ffmpeg

Called as an external command by `video_inference.py` for frame extraction.

This is not a Python package; it must be installed on the system and available on PATH.

### Groq

Used for:

- LLM anomaly reports in `backendd/app/services/llm_report.py`.
- Streaming chat in `backendd/app/api/routers/chat.py`.

### Frontend proxy integration

`Frontend/vite.config.js` proxies:

- `/api` -> `http://localhost:8000`
- `/training-videos` -> `http://localhost:8000`

This means the backend must be running on port `8000` for frontend development.

## Frontend summary

The frontend is a React/Vite app in `Frontend`.

Backend-facing components include:

- **`Frontend/src/components/Login/Login.jsx`**
  - Calls `/api/v1/auth/login`.

- **`Frontend/src/components/Signup/Signup.jsx`**
  - Calls `/api/v1/auth/register`.

- **`Frontend/src/context/UserContext.jsx`**
  - Calls `/api/v1/users/me`.

- **`Frontend/src/components/Upload/Upload.jsx`**
  - Uploads video to `/api/v1/predict/video`.
  - Displays `overall_summary`, segments, and returned `llm_report`.

- **`Frontend/src/components/Dashboard/Dashboard.jsx`**
  - Calls user stats/activity/trend/intelligence endpoints.

- **`Frontend/src/components/Reports/Reports.jsx`**
  - Lists and displays saved reports.

- **`Frontend/src/components/Chat/Chat.jsx`**
  - Calls chat thread endpoints.
  - Reads streaming response chunks.

- **`Frontend/src/components/Training/Training.jsx`**
  - Calls training session/progress/answer endpoints.
  - Displays local videos served by backend.

The frontend is not the main focus of this walkthrough, but it confirms how backend APIs are expected to behave.

## Known gaps / TODOs / technical debt

### `backend` folder exists but is not active for this walkthrough

The repository contains a `backend` folder, but this documentation intentionally covers `backendd`, because the active/original backend identified for this project is `backendd`.

### `llm_report` is not persisted during prediction

`AnalysisReport` has an `llm_report` field and the database initialization adds the column if needed, but `video_predict.py` does not set `llm_report` when creating `AnalysisReport`.

Impact:

- Upload page can show the generated LLM report immediately.
- Saved report detail may not show the report later.
- Dashboard LLM coverage may be inaccurate.

### Chat is not user-scoped

`ChatThread` and `ChatMessage` have no `user_id`.

Impact:

- Chat threads are global.
- Any user can potentially see shared chat history through the chat endpoints.
- Deleting one user deletes all chat threads/messages in `users.py`.

### Training is not auth-scoped

Training routes use client-supplied `user_id` instead of `get_current_user()`.

Impact:

- Anyone can submit progress for any `user_id` string.
- Progress is not strongly tied to authenticated accounts.

### Shared `tmp_frames` directory is unsafe for concurrent inference

`video_inference.py` uses one relative `tmp_frames` folder.

Impact:

- Concurrent uploads can delete or overwrite each other's extracted frames.
- A safer design would use per-request temporary directories.

### Model checkpoint path is relative

`get_gru_model()` defaults to `ucf_gru_model.pth`.

Impact:

- If the backend is launched from the wrong working directory, model loading may fail.
- Safer design would resolve the checkpoint relative to the `backendd` directory or configure it with an environment variable.

### Global summary may not match comment

The code comment says it should pick the highest-confidence abnormal class, else normal. The actual code picks the highest-confidence chunk overall.

Impact:

- A high-confidence normal chunk may override a lower-confidence abnormal chunk.
- This may reduce anomaly sensitivity.

### ffmpeg failures are hidden

`extract_frames_for_chunk()` suppresses output and uses `check=False`.

Impact:

- ffmpeg failure may show up later as empty frames or unknown output, not as a direct diagnostic error.

### Dependency files are inconsistent

`backendd/pyproject.toml` includes important ML and Groq dependencies such as:

- `torch`
- `torchvision`
- `timm`
- `opencv-python`
- `numpy`
- `Pillow`
- `groq`

But `backendd/requirements.txt` does not list all of those ML/Groq dependencies.

Impact:

- Installing from `requirements.txt` alone may not provide everything needed for inference/chat.

### Hardcoded database URL in migration script

`backendd/migrate_avatar.py` contains a hardcoded PostgreSQL URL.

Impact:

- Credentials and local DB assumptions are embedded in code.
- This should be replaced by `settings.DATABASE_URL` or a proper migration tool.

### Legacy label references

Frontend and analytics code still reference `NormalVideosforEventRecognition`, but current backend `CLASS_NAMES` uses `Normal`.

Impact:

- This is likely harmless normalization code, but it suggests labels changed over time.
- Developers should confirm the exact model label set before changing dashboards or reports.

### Gemini fallback settings are present but unused

Config includes Gemini-related settings, but chat currently requires Groq and does not implement Gemini fallback.

Impact:

- Environment variables may suggest behavior that does not exist yet.

## How to extend the backend safely

### Adding a new prediction class

If the ML model is retrained with a different class list:

1. Update `CLASS_NAMES` in `backendd/app/services/model_loader.py`.
2. Ensure `GRUClassifier(num_classes=...)` matches checkpoint output size.
3. Update dashboard severity weights in `backendd/app/api/routers/users.py`.
4. Update frontend display normalization if needed.
5. Test `run_video_inference()` with a known video.

### Changing the model checkpoint

Recommended approach:

1. Add a setting such as `MODEL_CHECKPOINT_PATH` in `config.py`.
2. Resolve the checkpoint path absolutely.
3. Pass that path into `get_gru_model()`.
4. Confirm the checkpoint architecture matches `GRUClassifier`.

### Making prediction concurrency safer

Recommended approach:

1. Replace global `TMP_FRAMES_DIR` with a per-request temporary directory.
2. Pass that directory through extraction/preprocessing functions.
3. Use `try/finally` to clean up only that request's files.
4. Avoid deleting shared folders.

### Persisting LLM reports correctly

Recommended approach:

1. In `video_predict.py`, set `llm_report=llm_report` when creating `AnalysisReport`.
2. Confirm the database column exists.
3. Re-test upload, reports page, and dashboard LLM coverage.

### Making chat user-specific

Recommended approach:

1. Add `user_id` to `ChatThread`.
2. Require `get_current_user()` in chat endpoints.
3. Filter thread list/detail/delete by current user.
4. Adjust account deletion to delete only that user's chat rows.
5. Add migration for existing rows.

### Making training user-specific

Recommended approach:

1. Require JWT auth on training endpoints.
2. Derive `user_id` from `current_user.id` or `current_user.email`.
3. Stop trusting client-supplied `user_id` for authenticated users.
4. Decide whether to store all question answers or classification-only answers.

### Adding a new training video/scenario

Steps:

1. Add the MP4 file to `backendd/videos`.
2. Add a matching `TrainingScenario` in `backendd/app/api/routers/training.py`.
3. Confirm `video_filename` exactly matches the file name.
4. Confirm `correct_label` matches the intended classification.
5. Test `/api/v1/training/scenarios` and frontend playback.

### Adding a new API router

Recommended pattern:

1. Create the router under `backendd/app/api/routers`.
2. Use schemas from `backendd/app/schemas` for request/response models.
3. Put reusable business logic in `backendd/app/services`.
4. Use `get_session()` for database access.
5. Use `get_current_user()` for user-specific data.
6. Include the router in `backendd/app/main.py` under `/api/v1`.

## Backend execution story

This section narrates the major backend flows from client request to response.

## Prediction execution story

1. A logged-in user opens the upload page in `Frontend/src/components/Upload/Upload.jsx`.
2. The user selects or drops a video file.
3. The frontend sends `POST /api/v1/predict/video` with a bearer token and multipart file.
4. Vite proxy forwards `/api` to the backend at `http://localhost:8000`.
5. FastAPI routes the request through `backendd/app/api/routers/video_predict.py`.
6. `get_current_user()` verifies the JWT and loads the user from PostgreSQL.
7. The router checks the file extension.
8. The router writes the upload to a temporary file.
9. `run_video_inference()` starts.
10. OpenCV reads the video duration.
11. The video is split into 30-minute chunks.
12. For each chunk, ffmpeg extracts frames at 2 FPS.
13. ConvNeXtV2 converts each frame into a 768-dimensional embedding.
14. Embeddings are grouped into 32-frame windows with stride 16.
15. The GRU classifier predicts probabilities over security event classes.
16. The backend builds chunk-level classification and anomaly segments.
17. The backend chooses an overall summary and marks status normal/abnormal.
18. If abnormal, Groq generates a human-readable anomaly report.
19. The backend creates an in-memory session ID for the anomaly/report.
20. The backend saves an `AnalysisReport` row for the current user.
21. The router adds `llm_report` and `session_id` to the inference result.
22. The temporary upload file is deleted.
23. FastAPI returns the result JSON.
24. The frontend displays classification, confidence, status, anomaly segments, and the report.

## Training module execution story

1. The user opens `Frontend/src/components/Training/Training.jsx`.
2. The frontend determines a `userId` from user context, local storage, or `anonymous`.
3. The frontend calls `GET /api/v1/training/session?limit=3&user_id=...`.
4. FastAPI routes the request to `training.py`.
5. Backend reads recent `TrainingAnswer` rows for that user ID.
6. Backend prioritizes scenarios that were not recently answered.
7. Backend returns selected hardcoded `TrainingScenario` objects.
8. Frontend renders the scenario and video.
9. Video source points to `/training-videos/{filename}`.
10. FastAPI serves the MP4 from `backendd/videos`.
11. User answers the classification question.
12. Frontend posts `POST /api/v1/training/answer` for the first question only.
13. Backend compares selected label to `scenario.correct_label`.
14. Backend saves a `TrainingAnswer` row.
15. Frontend fetches `/api/v1/training/progress`.
16. Backend aggregates attempts, correctness, per-label stats, and recent scenarios.
17. Frontend updates completion/accuracy display.
18. Additional threat-level/response questions are checked locally by the frontend and are not stored in the backend.

## Reports execution story

1. A prediction request saves an `AnalysisReport` row.
2. The user opens the reports page in `Frontend/src/components/Reports/Reports.jsx`.
3. The frontend reads the JWT from `localStorage`.
4. For the list page, it calls `GET /api/v1/users/me/reports`.
5. For a detail page, it calls `GET /api/v1/users/me/reports/{report_id}`.
6. `users.py` authenticates the token through `get_current_user()`.
7. The backend queries `AnalysisReport` rows filtered by `current_user.id`.
8. For detail, the backend also filters by `report_id`.
9. If the report does not exist or belongs to another user, backend returns `404`.
10. Otherwise, the report data is returned.
11. Frontend displays filename, status, class, confidence, duration, created time, and `llm_report` if present.

Important note:

- Because prediction currently does not persist `llm_report`, the report detail page may show “No LLM report was generated” even when the upload response originally displayed one.

## Chat execution story

1. User opens `Frontend/src/components/Chat/Chat.jsx`.
2. Frontend calls `GET /api/v1/chat/threads`.
3. Backend returns all chat threads ordered by latest update.
4. User creates/selects a thread.
5. When user sends a message, frontend posts to `POST /api/v1/chat/threads/{thread_id}/messages`.
6. Backend checks that `GROQ_API_KEY` is set.
7. Backend loads the chat thread.
8. Backend saves the user's message.
9. Backend loads recent messages for context.
10. Backend trims old context messages if needed.
11. Backend builds a SecureVision AI system prompt.
12. Backend sends a streaming chat completion request to Groq.
13. Backend immediately yields a `ping` event.
14. When Groq starts responding, backend yields a `meta` event and then repeated data chunks containing deltas.
15. Frontend reads the stream with `ReadableStream.getReader()` and appends deltas to the visible assistant message.
16. If Groq fails or returns no text, backend emits an `error` event.
17. If successful, backend sanitizes identity claims, saves the assistant message, updates thread timestamp, and emits `done`.
18. Frontend refreshes thread history.

Important note:

- Current chat is not authenticated and not user-scoped, so all chat threads are effectively shared backend data.

## Final developer notes

The most important backend files to understand first are:

- `backendd/app/main.py`
- `backendd/app/api/routers/video_predict.py`
- `backendd/app/services/video_inference.py`
- `backendd/app/services/model_loader.py`
- `backendd/app/services/llm_report.py`
- `backendd/app/api/routers/users.py`
- `backendd/app/api/routers/chat.py`
- `backendd/app/api/routers/training.py`
- `backendd/app/db/session.py`
- `backendd/app/models/*.py`

For future work, the highest-impact improvements are:

- Persist generated `llm_report` into `AnalysisReport`.
- Make chat data user-scoped.
- Make training progress authenticated/user-scoped.
- Use per-request temp directories for video inference.
- Make model checkpoint path explicit and robust.
- Align dependency files so installation is reliable.
