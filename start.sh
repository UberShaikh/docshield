#!/usr/bin/env bash
# ============================================================
#  DocShield — Local Development Start Script
#  Starts all 3 services in separate terminal sessions
# ============================================================
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

echo -e "${CYAN}"
echo "  ██████╗  ██████╗  ██████╗███████╗██╗  ██╗██╗███████╗██╗     ██████╗ "
echo "  ██╔══██╗██╔═══██╗██╔════╝██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗"
echo "  ██║  ██║██║   ██║██║     ███████╗███████║██║█████╗  ██║     ██║  ██║"
echo "  ██║  ██║██║   ██║██║     ╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║"
echo "  ██████╔╝╚██████╔╝╚██████╗███████║██║  ██║██║███████╗███████╗██████╔╝"
echo "  ╚═════╝  ╚═════╝  ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝ "
echo -e "${RESET}"
echo -e "${GREEN}  Document Fraud Detection System — Local Dev${RESET}"
echo ""

# ── Check prerequisites ───────────────────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}✗ '$1' not found. Please install it first.${RESET}"
    exit 1
  fi
}

check_cmd python3
check_cmd pip3
check_cmd node
check_cmd npm

echo -e "${GREEN}✓ All prerequisites found${RESET}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── AI Service ────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/3] Setting up AI Service (Python/FastAPI)...${RESET}"
cd "$SCRIPT_DIR/ai-service"

if [ ! -d "venv" ]; then
  echo "  Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
echo "  Installing Python dependencies (this may take a few minutes first time)..."
pip install -q -r requirements.txt

echo -e "${GREEN}  ✓ AI Service ready${RESET}"
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/3] Setting up Backend (Node.js/Express)...${RESET}"
cd "$SCRIPT_DIR/backend"

if [ ! -d "node_modules" ]; then
  echo "  Installing Node dependencies..."
  npm install --silent
fi

echo -e "${GREEN}  ✓ Backend ready${RESET}"
echo ""

# ── Frontend ──────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/3] Setting up Frontend (React)...${RESET}"
cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
  echo "  Installing Node dependencies..."
  npm install --silent
fi

echo -e "${GREEN}  ✓ Frontend ready${RESET}"
echo ""

# ── Launch all services ───────────────────────────────────────────────────────
echo -e "${CYAN}Starting all services...${RESET}"
echo ""

# AI Service
cd "$SCRIPT_DIR/ai-service"
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
AI_PID=$!
echo -e "  ${GREEN}✓ AI Service started${RESET} (PID $AI_PID) → http://localhost:8000"

sleep 2

# Backend
cd "$SCRIPT_DIR/backend"
PORT=4000 AI_SERVICE_URL=http://localhost:8000 node server.js &
BACKEND_PID=$!
echo -e "  ${GREEN}✓ Backend started${RESET}    (PID $BACKEND_PID) → http://localhost:4000"

sleep 1

# Frontend
cd "$SCRIPT_DIR/frontend"
REACT_APP_API_URL="" PORT=3000 npm start &
FRONTEND_PID=$!
echo -e "  ${GREEN}✓ Frontend starting${RESET}  (PID $FRONTEND_PID) → http://localhost:3000"

echo ""
echo -e "${CYAN}════════════════════════════════════════════${RESET}"
echo -e "${GREEN}  🚀 DocShield is running!${RESET}"
echo -e "${CYAN}════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Frontend  → ${CYAN}http://localhost:3000${RESET}"
echo -e "  Backend   → ${CYAN}http://localhost:4000${RESET}"
echo -e "  AI API    → ${CYAN}http://localhost:8000/docs${RESET}"
echo ""
echo -e "${YELLOW}  Press Ctrl+C to stop all services${RESET}"
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping all services...${RESET}"
  kill $AI_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}All services stopped.${RESET}"
  exit 0
}

trap cleanup SIGINT SIGTERM
wait
