from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    get_settings().database_url,
    # The API runs as a long-lived service on Render.  Avoiding a pre-flight
    # ping on every request removes an unnecessary round-trip to Supabase;
    # pool recycling still prevents stale connections from accumulating.
    pool_pre_ping=False,
    pool_recycle=1800,
    pool_size=5,
    max_overflow=5,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
