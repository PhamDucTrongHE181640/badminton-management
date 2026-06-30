from __future__ import annotations

from pathlib import Path

import psycopg

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    if not settings.user_import_enabled:
        print("Bulk user import disabled; skipping.")
        return

    sql_path = Path(settings.user_import_sql_path)
    if not sql_path.exists():
        print(f"Bulk user import SQL not found at {sql_path}; skipping.")
        return

    database_url = settings.database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    sql = sql_path.read_text(encoding="utf-8")

    with psycopg.connect(database_url, autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)

    print(f"Bulk user import completed from {sql_path}.")


if __name__ == "__main__":
    main()
