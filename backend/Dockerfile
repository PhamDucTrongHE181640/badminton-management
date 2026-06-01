FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml ./
COPY requirements.txt ./
RUN pip install --upgrade pip \
 && pip install -r requirements.txt \
 && pip install -e ".[dev]"

COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app
COPY database ./database
COPY entrypoint.sh ./entrypoint.sh

EXPOSE 8000

CMD ["sh", "/app/entrypoint.sh"]
