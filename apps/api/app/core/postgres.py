from __future__ import annotations

from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.db_url import sanitize_db_url


settings = get_settings()


@contextmanager
def get_connection():
    url = sanitize_db_url(settings.direct_url or settings.database_url)
    connection = psycopg.connect(url, row_factory=dict_row)
    try:
        yield connection
    finally:
        connection.close()