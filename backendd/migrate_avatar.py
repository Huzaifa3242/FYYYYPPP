from sqlalchemy import create_engine, text

engine = create_engine("postgresql+psycopg://postgres:admin123@localhost:5432/postgres")
with engine.connect() as conn:
    conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS avatar_url TEXT'))
    conn.commit()
print("Done: avatar_url column added")
