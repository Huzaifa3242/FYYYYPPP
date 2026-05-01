from app.db.session import engine
from sqlmodel import text, Session

with Session(engine) as session:
    res = session.execute(text("SELECT id, filename, status, created_at FROM analysisreport")).fetchall()
    for row in res:
        print(row)

