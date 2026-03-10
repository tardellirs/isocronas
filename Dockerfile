# ─────────────────────────────────────────────────
# Stage 1 — Builder: Node.js build do frontend Vite
# ─────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

# Copia apenas os arquivos de dependências primeiro (melhor cache)
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# Copia o código-fonte do frontend
COPY index.html vite.config.js ./
COPY src/ ./src/

# Build arguments para as API keys (injetadas em tempo de build pelo Vite)
ARG VITE_ORS_API_KEY
ARG VITE_GEMINI_API_KEY

# Executa o build de produção
RUN npm run build


# ─────────────────────────────────────────────────
# Stage 2 — Runtime: Python + FastAPI
# ─────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Metadados da imagem
LABEL org.opencontainers.image.title="M2G2 Isócronas"
LABEL org.opencontainers.image.description="Calculadora de isócronas com dados censitários IBGE"
LABEL org.opencontainers.image.source="https://github.com/tardellirs/isocronas"

WORKDIR /app

# Instala dependências do sistema necessárias para o Shapely/SQLite
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-mod-spatialite \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o backend
COPY backend/ ./backend/

# Copia o dist/ gerado no stage anterior
COPY --from=builder /build/dist ./dist

# O volume do GeoPackage IBGE será montado em /app/malha
# (não copiado para a imagem — o arquivo tem ~1.5 GB)
RUN mkdir -p /app/malha

# Permite que 'from gpkg_utils import ...' e 'from models import ...' funcionem
# quando o uvicorn é chamado como 'backend.server:app' a partir de /app
ENV PYTHONPATH=/app/backend

# Usuário não-root para segurança
RUN useradd -r -s /bin/false appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["python", "-m", "uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
