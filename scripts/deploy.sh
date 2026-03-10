#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Script de deploy manual para a instância Oracle Ampere
# Uso: ./scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$HOME/isocronas"

echo "🐳 Isócronas — Deploy Manual"
echo "═══════════════════════════════"

# Garante que estamos no diretório certo
if [ ! -d "$REPO_DIR" ]; then
  echo "❌ Diretório $REPO_DIR não encontrado."
  echo "   Execute primeiro: git clone <repo> ~/isocronas"
  exit 1
fi

cd "$REPO_DIR"

echo "📥 Sincronizando código..."
git fetch origin main
git reset --hard origin/main

echo "🔨 Buildando imagens Docker..."
docker compose build --no-cache

echo "⬆️  Subindo containers..."
docker compose up -d

echo "🧹 Limpando imagens antigas..."
docker image prune -f

echo ""
echo "📊 Status dos containers:"
docker compose ps

echo ""
echo "📋 Logs recentes (últimas 20 linhas):"
docker compose logs --tail=20

echo ""
echo "✅ Deploy finalizado! Acesse: https://iso.imob.dev"
