from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def make_session_factory(url: str) -> sessionmaker:
    engine = create_engine(url, pool_pre_ping=True, pool_size=10)
    return sessionmaker(engine, expire_on_commit=False)
