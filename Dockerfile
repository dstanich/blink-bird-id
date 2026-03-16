FROM node:20-slim

# Install Python, build tools (for better-sqlite3), and curl (for uv installer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json package-lock.json pyproject.toml ./

# Install Node dependencies
RUN npm ci

# Create Python venv and install Python dependencies
RUN uv venv .venv && uv pip install -e .

# Copy remaining source files
COPY . .

# Create persistent directories
RUN mkdir -p data downloads config

VOLUME ["/app/data", "/app/downloads", "/app/config"]

CMD ["npm", "start"]
