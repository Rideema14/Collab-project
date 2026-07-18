# Use a slim Python image for a smaller footprint
FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_LINK_MODE=copy

WORKDIR /app

# Install Python dependencies (project uses uv/pyproject.toml, not requirements.txt)
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev

# Copy the agent code and finish installing (picks up the project itself).
# agent.py imports transcript.py, which imports bridge.py, so all three must be
# in the image or the worker crashes on startup with ModuleNotFoundError.
COPY agent.py transcript.py bridge.py ./
RUN uv sync --locked --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Run the agent in production mode
CMD ["python", "agent.py", "start"]