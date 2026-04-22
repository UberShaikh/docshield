# DocShield — AI-Powered Document Fraud Detection

A production-grade, full-stack document fraud detection system using pretrained deep learning (EfficientNet), OpenCV computer vision, Tesseract OCR, and EXIF forensics.

```
┌─────────────────────────────────────────────────────────────┐
│                     DocShield Architecture                   │
├──────────────┬─────────────────────┬────────────────────────┤
│   Frontend   │      Backend        │      AI Service        │
│  React + CSS │  Node.js / Express  │  Python / FastAPI      │
│  Port 3000   │     Port 4000       │     Port 8000          │
│              │  (API proxy/gw)     │  EfficientNet          │
│  Dashboard   │                     │  OpenCV                │
│  Upload UI   │  File forwarding    │  Tesseract OCR         │
│  Heatmap     │  Static proxy       │  EXIF analysis         │
│  Batch view  │                     │  Heatmap gen           │
└──────────────┴─────────────────────┴────────────────────────┘
```

---

## 🚀 Quick Start

### Option A — Docker (Recommended, easiest)

**Prerequisites:** Docker + Docker Compose installed

```bash
# Clone / unzip the project
cd doc-fraud-detector

# Build and start all services (first build downloads EfficientNet weights ~25MB)
docker compose up --build

# Open browser
open http://localhost:3000
```

> First build takes ~5-10 minutes (downloads Python packages + PyTorch + model weights).
> Subsequent starts take ~15 seconds.

---

### Option B — Local Development (no Docker)

**Prerequisites:**
- Python 3.9+ with `pip`
- Node.js 18+ with `npm`
- Tesseract OCR installed on your system

#### Install Tesseract

| OS | Command |
|----|---------|
| macOS | `brew install tesseract` |
| Ubuntu/Debian | `sudo apt install tesseract-ocr` |
| Windows | Download installer from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki) |

#### macOS / Linux

```bash
cd doc-fraud-detector
chmod +x start.sh
./start.sh
```

#### Windows

```batch
cd doc-fraud-detector
start.bat
```

The script will:
1. Create a Python virtual environment
2. Install all Python dependencies (PyTorch, OpenCV, FastAPI, etc.)
3. Install Node.js dependencies for backend and frontend
4. Launch all 3 services automatically

**URLs:**
- 🖥 Frontend: http://localhost:3000
- 🔌 Backend API: http://localhost:4000
- 🤖 AI Service (Swagger): http://localhost:8000/docs

---

## 🧠 Processing Pipeline

```
Document Upload
      │
      ▼
 ┌─────────┐    ┌─────────────┐    ┌──────────────────┐
 │   OCR   │    │  Metadata   │    │  Tampering       │
 │Tesseract│    │EXIF Analysis│    │  OpenCV          │
 │Text ext │    │Timestamp    │    │  Edge/Noise/Copy │
 │Score/10 │    │Software det │    │  move detection  │
 └────┬────┘    └──────┬──────┘    └────────┬─────────┘
      │                │                    │
      └────────────────┼────────────────────┘
                       │
              ┌────────▼────────┐
              │   EfficientNet  │
              │  (ImageNet B0)  │
              │  Confidence +   │
              │  Entropy score  │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  Fraud Scoring  │
              │  AI:   0–40 pts │
              │  Tamper: 0–30   │
              │  Meta:  0–20    │
              │  OCR:   0–10    │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │ Heatmap (OpenCV)│
              │ JET colormap    │
              │ overlay output  │
              └─────────────────┘
```

### Fraud Score Breakdown

| Component | Max Points | Detection Method |
|-----------|-----------|-----------------|
| AI Model (EfficientNet) | 40 | Confidence entropy + feature distribution |
| Tampering (OpenCV) | 30 | Edge variance, noise analysis, copy-move ORB |
| Metadata (EXIF) | 20 | Software traces, timestamp mismatches |
| OCR Analysis | 10 | Suspicious text patterns, garbled characters |
| **Total** | **100** | |

### Risk Levels
- 🟢 **LOW** (0–39): Document appears authentic
- 🟡 **MEDIUM** (40–69): Some suspicious indicators, manual review recommended
- 🔴 **HIGH** (70–100): Multiple fraud signals detected

---

## 📡 API Reference

### `POST /analyze`
Analyze a single document.

```bash
curl -X POST http://localhost:4000/analyze \
  -F "file=@document.jpg"
```

**Response:**
```json
{
  "fraud_score": 72,
  "risk_level": "HIGH",
  "reasons": [
    "AI_MODEL_FLAGGED_FAKE",
    "TAMPERING_DETECTED",
    "Edited with image software: Adobe Photoshop",
    "Copy-move artifacts detected (12 regions)"
  ],
  "heatmap_url": "http://localhost:4000/proxy/heatmaps/heatmap_a3f1b2c4.jpg",
  "ocr_text": "INVOICE #12345...",
  "metadata": {
    "Software": "Adobe Photoshop 24.0",
    "DateTime": "2024:01:15 14:32:10"
  },
  "ai_score": 0.714,
  "tampering_score": 0.667,
  "metadata_score": 0.6,
  "ocr_score": 0.0,
  "processing_time": 2.34,
  "page_count": 1
}
```

### `POST /analyze-batch`
Analyze up to 10 documents at once.

```bash
curl -X POST http://localhost:4000/analyze-batch \
  -F "files=@doc1.jpg" \
  -F "files=@doc2.pdf" \
  -F "files=@doc3.png"
```

### `GET /health`
Check system status.

---

## 📁 Project Structure

```
doc-fraud-detector/
├── ai-service/              # Python FastAPI AI backend
│   ├── main.py              # Full pipeline: OCR, metadata, OpenCV, EfficientNet
│   ├── requirements.txt
│   └── Dockerfile
│
├── backend/                 # Node.js Express API gateway
│   ├── server.js            # File proxy + static asset serving
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                # React.js dashboard
│   ├── src/
│   │   ├── App.js           # Root + header
│   │   ├── pages/
│   │   │   └── Dashboard.js # Main upload/result page
│   │   └── components/
│   │       ├── UploadZone.js     # Drag-and-drop upload
│   │       ├── ResultPanel.js    # Fraud report viewer (4 tabs)
│   │       └── BatchResults.js   # Multi-document grid
│   ├── public/
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml       # One-command orchestration
├── start.sh                 # macOS/Linux local dev launcher
├── start.bat                # Windows local dev launcher
└── README.md
```

---

## 🔧 Configuration

### Environment Variables

| Service | Variable | Default | Description |
|---------|----------|---------|-------------|
| Backend | `AI_SERVICE_URL` | `http://localhost:8000` | AI service URL |
| Backend | `PORT` | `4000` | Backend port |
| Frontend | `REACT_APP_API_URL` | `` (uses proxy) | Backend URL for browser |
| AI Service | (none) | — | Auto-detects CPU/GPU |

### GPU Support
If you have an NVIDIA GPU, PyTorch will automatically use it. Ensure you have:
- NVIDIA drivers installed
- CUDA toolkit matching your PyTorch version
- For Docker: use `nvidia/cuda` base image and add `runtime: nvidia` to the compose service

---

## 🔬 AI Model Details

**EfficientNet-B0** (ImageNet pretrained, no fine-tuning required):

The system uses a heuristic approach on top of ImageNet features:
- **Confidence entropy**: Authentic documents produce coherent, recognizable features → low entropy. Composited/forged images produce scattered activations → high entropy.
- **Top-1 confidence**: Documents with unnaturally low classification confidence suggest incoherent pixel patterns typical of manipulated images.
- **Prediction ambiguity**: Very similar top-2 probabilities indicate the model cannot recognize a stable, coherent scene — a hallmark of spliced images.

This is a **zero-shot** approach using pretrained weights without any forgery-specific training data.

---

## 🛠 Troubleshooting

| Problem | Solution |
|---------|----------|
| `tesseract not found` | Install Tesseract for your OS (see above) |
| Port already in use | Change ports in `start.sh` or `docker-compose.yml` |
| PyTorch install slow | Normal — PyTorch is ~800MB. Use Docker for reproducibility |
| `pdf2image` error | Install `poppler-utils` (Linux) or `poppler` (macOS: `brew install poppler`) |
| CORS errors in browser | Ensure backend is running on port 4000 |
| Heatmap not loading | Check AI service is accessible; check backend proxy `/proxy/*` route |

---

## 📦 Dependencies Summary

### AI Service (Python)
- `fastapi` + `uvicorn` — HTTP server
- `torch` + `torchvision` — EfficientNet pretrained model
- `opencv-python-headless` — Image forensics
- `pytesseract` — OCR
- `Pillow` — Image/EXIF reading
- `pdf2image` — PDF conversion

### Backend (Node.js)
- `express` — HTTP server
- `multer` — File upload handling
- `axios` — HTTP proxy to AI service
- `form-data` — Multipart forwarding

### Frontend (React)
- `react-dropzone` — Drag-and-drop upload
- `recharts` — Score visualizations
- `framer-motion` — Animations
- `axios` — API calls

---

## ✨ Features

✅ **Single & Batch Document Upload** — Analyze 1 or up to 10 documents at once  
✅ **Real-time Heatmap Visualization** — Grad-CAM fraud region highlighting  
✅ **Multi-format Support** — JPG, PNG, PDF (auto-converted to images)  
✅ **Forensic Analysis** — Tampering, metadata, OCR, AI model consistency checks  
✅ **Analytics Dashboard** — View historical analyses, statistics, trends  
✅ **Full REST API** — Integrate with any application  
✅ **Docker Ready** — One-command deployment to any cloud  
✅ **Production Fraud Scores** — 0–100 scale with risk levels (LOW/MEDIUM/HIGH)  

---

## 🐛 Latest Fixes (v1.0)

- ✅ Fixed Pillow dependency incompatibility (→ 11.0.0)
- ✅ Fixed Grad-CAM gradient computation in eval mode
- ✅ Fixed frontend score display (was multiplying by 100)
- ✅ Added PDF support with page counting
- ✅ Implemented `/analyze-batch` endpoint for multi-file analysis
- ✅ Added `/history` paginated endpoint with detail view
- ✅ Added `/stats` analytics endpoint with timeline & risk distribution
- ✅ Added proper error handling for all fraud detection paths
- ✅ Fixed database NULL constraints on fraud scores
- ✅ Added heatmap proxy routing for proper image serving

---

## 📊 System Status

| Component | Status | Port | Health |
|-----------|--------|------|--------|
| Frontend (React/Nginx) | ✅ Running | 3000 | http://localhost:3000 |
| Backend (Node/Express) | ✅ Running | 4000 | http://localhost:4000/health |
| AI Service (Python/FastAPI) | ✅ Running | 8000 | http://localhost:8000/health |

---

## 🚢 License

MIT — Free to use, modify, distribute

---

## 📧 Support

For issues, questions, or contributions → Open an issue or submit a pull request.

**Built with:** PyTorch • FastAPI • React • Express • Docker
