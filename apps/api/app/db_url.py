from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def sanitize_db_url(url: str) -> str:
    """Drop Supabase pooler query params that break asyncpg/psycopg.

    Supabase's copy-paste pooler string appends ``?pgbouncer=true&connection_limit=1``.
    The asyncpg dialect forwards unknown URL query params to ``asyncpg.connect()``
    as kwargs (TypeError), and psycopg rejects ``connection_limit`` as an invalid
    libpq option. Only those two params are removed; everything else (e.g.
    ``sslmode``) is preserved.
    """
    parts = urlsplit(url)
    if not parts.query:
        return url
    kept = [
        (key, value)
        for key, value in parse_qsl(parts.query)
        if key not in {"pgbouncer", "connection_limit"}
    ]
    return urlunsplit(parts._replace(query=urlencode(kept)))
