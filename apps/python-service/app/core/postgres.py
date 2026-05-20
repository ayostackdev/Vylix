from __future__ import annotations

from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings


settings = get_settings()


@contextmanager
def get_connection():
    connection = psycopg.connect(settings.postgres_dsn, row_factory=dict_row)
    try:
        yield connection
    finally:
        connection.close()