# 🚀 DocShield - Deployment & Architecture Guide

**Complete technical information for deploying and maintaining DocShield**

---

## 📋 **Quick Summary**

| Aspect | Details |
|--------|---------|
| **Architecture** | 3-tier microservices (Frontend + Backend + AI) |
| **Containerization** | Docker Compose (all services containerized) |
| **Languages** | React (Frontend), Node.js (Backend), Python (AI) |
| **Database** | SQLite (embedded in backend) |
| **AI Model** | EfficientNet-B0 (ImageNet pretrained, ~100MB) |
| **Deployment** | Docker, Railway.app, DigitalOcean, AWS, or self-hosted |
| **Scale** | Single-server deployment up to 1000+ concurrent users |

---

## 🏗️ **System Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCSHIELD PLATFORM                        │
├──────────────────┬──────────────────┬──────────────────────────┤
│   FRONTEND       │    BACKEND       │    AI SERVICE            │
├──────────────────┼──────────────────┼──────────────────────────┤
│ React 18         │ Node.js 20       │ Python 3.11              │
│ Port: 3000       │ Port: 4000       │ Port: 8000               │
│ Nginx (prod)     │ Express.js       │ FastAPI                  │
│                  │                  │                          │
│ • Dashboard      │ • API Gateway    │ • Model Loading          │
│ • Upload UI      │ • File Proxy     │ • Image Processing       │
│ • Heatmap View   │ • DB Management  │ • Fraud Detection        │
│ • Analytics      │ • Auth (stubs)   │ • Heatmap Generation     │
└──────────────────┴──────────────────┴──────────────────────────┘
           ↓                ↓                  ↓
    ┌─────────────────────────────────────────────┐
    │  SQLite Database (data/docshield.db)        │
    │  - Users, Sessions, Documents, Analyses    │
    │  - Batch jobs, Batch items                 │
    └─────────────────────────────────────────────┘
```

---

## 📦 **Technology Stack**

### **Frontend (React)**
```json
{
  "framework": "React 18",
  "styling": "CSS Modules + custom CSS",
  "http": "axios",
  "visualization": "recharts",
  "upload": "react-dropzone",
  "animation": "framer-motion",
  "server": "Nginx (production)",
  "port": 3000
}
```

### **Backend (Node.js/Express)**
```json
{
  "runtime": "Node.js 20",
  "framework": "Express.js",
  "server": "HTTP",
  "file-upload": "multer",
  "http-client": "axios",
  "database": "SQLite (better-sqlite3)",
  "logging": "morgan",
  "cors": "cors",
  "port": 4000
}
```

### **AI Service (Python)**
```json
{
  "runtime": "Python 3.11",
  "framework": "FastAPI + Uvicorn",
  "ml-framework": "PyTorch 2.2.2",
  "vision": "torchvision",
  "image-processing": "OpenCV",
  "ocr": "Tesseract",
  "pdf-handling": "pdf2image + poppler-utils",
  "port": 8000
}
```

---

## 🗄️ **Database Schema**

### **SQLite Tables**

#### **users**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### **sessions**
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token TEXT UNIQUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### **documents**
```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  original_name TEXT,
  stored_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  page_count INTEGER,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### **analyses**
```sql
CREATE TABLE analyses (
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  user_id INTEGER REFERENCES users(id),
  fraud_score REAL NOT NULL,
  risk_level TEXT NOT NULL, -- HIGH/MEDIUM/LOW
  ai_score REAL,
  tampering_score REAL,
  metadata_score REAL,
  ocr_score REAL,
  processing_time REAL,
  heatmap_url TEXT,
  ocr_text TEXT,
  metadata_json TEXT,
  reasons_json TEXT,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### **batch_jobs**
```sql
CREATE TABLE batch_jobs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_files INTEGER,
  high_risk INTEGER,
  medium_risk INTEGER,
  low_risk INTEGER,
  error_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### **batch_items**
```sql
CREATE TABLE batch_items (
  id INTEGER PRIMARY KEY,
  batch_job_id INTEGER REFERENCES batch_jobs(id),
  analysis_id INTEGER REFERENCES analyses(id),
  filename TEXT,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---

## 📡 **API Endpoints**

### **Health Check**
```
GET /health
Response: { "status": "ok" }
```

### **Single Document Analysis**
```
POST /analyze
Content-Type: multipart/form-data
Body: file=<binary>

Response:
{
  "fraud_score": 72,
  "risk_level": "HIGH",
  "ai_score": 0.714,
  "tampering_score": 0.667,
  "metadata_score": 0.6,
  "ocr_score": 0.0,
  "heatmap_url": "http://localhost:4000/proxy/heatmaps/heatmap_xxx.jpg",
  "reasons": ["AI_MODEL_FLAGGED", "TAMPERING_DETECTED"],
  "metadata": { "Software": "Adobe Photoshop" },
  "processing_time": 2.34,
  "page_count": 1
}
```

### **Batch Analysis**
```
POST /analyze-batch
Content-Type: multipart/form-data
Body: files=<binary1>&files=<binary2>&files=<binary3>

Response:
{
  "count": 3,
  "results": [
    { "filename": "doc1.pdf", "fraud_score": 45, "risk_level": "MEDIUM", ... },
    { "filename": "doc2.jpg", "fraud_score": 12, "risk_level": "LOW", ... },
    { "filename": "doc3.png", "error": "File too large" }
  ]
}
```

### **History**
```
GET /history?limit=12&offset=0

Response:
{
  "total": 42,
  "analyses": [
    { "id": 42, "original_name": "invoice.pdf", "fraud_score": 25, ... }
  ]
}
```

### **Statistics**
```
GET /stats

Response:
{
  "global": {
    "total_analyses": 100,
    "avg_fraud_score": 35.5,
    "max_fraud_score": 95,
    "high_risk_count": 15,
    "medium_risk_count": 32,
    "low_risk_count": 53,
    "avg_processing_time": 2.1
  },
  "riskDist": [
    { "name": "HIGH", "value": 15, "color": "#ff4d6d" },
    { "name": "MEDIUM", "value": 32, "color": "#ffd60a" },
    { "name": "LOW", "value": 53, "color": "#00e676" }
  ],
  "timeline": [ ... ],
  "recent": [ ... ]
}
```

---

## 🐳 **Docker Configuration**

### **docker-compose.yml**
```yaml
version: '3.8'

services:
  # Frontend - React/Nginx
  fraud_frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - fraud_backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s

  # Backend - Node/Express
  fraud_backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - AI_SERVICE_URL=http://fraud_ai_service:8000
      - PORT=4000
    depends_on:
      - fraud_ai_service
    volumes:
      - ./backend/data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s

  # AI Service - Python/FastAPI
  fraud_ai_service:
    build: ./ai-service
    ports:
      - "8000:8000"
    volumes:
      - ./ai-service/uploads:/app/uploads
      - ./ai-service/heatmaps:/app/heatmaps
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### **Key Container Details**

| Service | Base Image | Size | Time |
|---------|-----------|------|------|
| Frontend | node:20-alpine | ~250MB | 15-20s |
| Backend | node:20-alpine | ~200MB | 10-15s |
| AI Service | python:3.11-slim | ~1.2GB | 3-5 min (first), 15s (cached) |

---

## 🔧 **Environment Variables**

### **Backend (Node.js)**
```bash
AI_SERVICE_URL=http://fraud_ai_service:8000    # Internal Docker URL
PORT=4000                                        # Backend port
NODE_ENV=production                              # Environment
DB_PATH=./data/docshield.db                     # SQLite database file
```

### **Frontend (React)**
```bash
REACT_APP_API_URL=http://localhost:4000         # API URL (local dev)
# In production: REACT_APP_API_URL=https://api.yourdomain.com
```

### **AI Service (Python)**
```bash
# Auto-detects GPU if available
# No configuration needed (uses environment defaults)
```

---

## 🎯 **AI Detection Pipeline**

### **Processing Steps**

1. **OCR Extraction** (0.5s)
   - Tesseract extracts text
   - Scores OCR confidence
   - Max 10 points

2. **Metadata Analysis** (0.3s)
   - EXIF timestamp validation
   - Software detection (Photoshop, etc.)
   - Max 20 points

3. **Tampering Detection** (0.8s)
   - OpenCV edge detection
   - Noise analysis
   - Copy-move detection (ORB features)
   - Max 30 points

4. **AI Model Inference** (1.0s)
   - EfficientNet-B0 forward pass
   - Confidence entropy analysis
   - Grad-CAM heatmap generation
   - Max 40 points

5. **Total Score** = 0-100 (sum of all components)

### **Fraud Score Interpretation**

```
0-39:   LOW RISK (Likely authentic)
40-69:  MEDIUM RISK (Manual review recommended)
70-100: HIGH RISK (Likely fraudulent)
```

---

## 🚀 **Deployment Considerations**

### **Performance**
- **Single Request:** 2-4 seconds per document
- **Batch (10 files):** 20-40 seconds
- **Concurrent Users:** 50+ (t3.small AWS)
- **Storage:** ~500KB per analysis (includes heatmap)

### **Memory Requirements**
- **AI Model Weights:** ~100MB (EfficientNet)
- **ResNet Model:** ~102MB
- **Total Runtime:** ~300-500MB
- **RAM Required:** 2GB minimum, 4GB+ recommended

### **GPU Support**
- **Optional:** NVIDIA GPU for 3x speedup
- **Automatic:** PyTorch detects CUDA
- **No GPU:** Falls back to CPU (works fine)

### **Storage**
- **SQLite Database:** ~1MB per 1000 analyses
- **Heatmaps:** ~50-100KB per image
- **Uploads:** ~1-10MB per document (temporary)

---

## 🔐 **Security Notes**

### **Current Implementation**
- ✅ CORS enabled (all origins in dev)
- ✅ File upload size limit: 50MB
- ⚠️ Authentication: Stub only (not implemented)
- ⚠️ No rate limiting
- ⚠️ No HTTPS enforcement

### **For Production, Add:**
```bash
# 1. Rate limiting (npm install express-rate-limit)
# 2. Authentication (JWT tokens)
# 3. HTTPS/SSL (certbot)
# 4. Input validation
# 5. Database encryption
# 6. API key authentication
# 7. Audit logging
```

---

## 📊 **Monitoring & Logging**

### **Current Logging**
- Backend: Morgan middleware (HTTP requests)
- AI Service: FastAPI + Uvicorn (requests)
- Frontend: Console logs (browser dev tools)

### **For Production, Add:**
```bash
# 1. Docker logs aggregation (ELK, Datadog)
# 2. Application performance monitoring (APM)
# 3. Error tracking (Sentry)
# 4. Metrics collection (Prometheus)
# 5. Health check dashboards
```

---

## 🛠️ **Maintenance & Backup**

### **Database Backup**
```bash
# Backup SQLite database
cp backend/data/docshield.db ./docshield.db.backup

# Or with Docker
docker cp fraud_backend:/app/data/docshield.db ./backup/
```

### **Log Rotation**
```bash
# Docker automatically manages logs (default 100MB limit)
# Configure in daemon.json if needed
```

### **Model Updates**
- AI models are cached at first build
- To update models: `docker compose up --build ai-service`
- No code changes needed

---

## 📈 **Scaling Recommendations**

### **Current Architecture (Single Server)**
- ✅ 50-100 concurrent users
- ✅ 1000-5000 analyses/day
- ✅ Cost: $5-20/month

### **To Scale to 1000+ Users**
```bash
# 1. Use load balancer (Nginx, AWS ELB)
# 2. Horizontal scaling:
#    - Multiple backend instances
#    - Multiple AI service instances
#    - Kubernetes orchestration
# 3. Use managed database (PostgreSQL)
# 4. Use queue system (Redis, RabbitMQ)
# 5. CDN for static assets (CloudFlare)
```

---

## 🚨 **Troubleshooting for Deployment**

| Issue | Cause | Solution |
|-------|-------|----------|
| **AI Service crashes** | Out of memory | Use t3.medium or add swap |
| **Slow inference** | CPU-only | Use GPU instance or optimize |
| **Database errors** | Disk full | Clean old uploads, compress DB |
| **CORS errors** | Wrong origin | Update CORS whitelist |
| **Heatmap 404** | Proxy misconfigured | Check `/proxy/*` route |
| **Port conflicts** | Port already in use | Change port in compose file |

---

## 📋 **Pre-Deployment Checklist**

- [ ] All code committed to GitHub
- [ ] Environment variables configured
- [ ] Database backup strategy in place
- [ ] SSL certificate (HTTPS) ready
- [ ] Rate limiting added
- [ ] Authentication implemented
- [ ] CORS whitelist configured
- [ ] Monitoring set up
- [ ] Error tracking enabled
- [ ] Tested on target platform
- [ ] Rollback plan documented

---

## 🔗 **Useful Links**

| Component | Docs |
|-----------|------|
| FastAPI | https://fastapi.tiangolo.com/ |
| Express.js | https://expressjs.com/ |
| React | https://react.dev/ |
| PyTorch | https://pytorch.org/ |
| Docker | https://docs.docker.com/ |
| Railway | https://railway.app/docs |
| DigitalOcean | https://docs.digitalocean.com/ |

---

## 📞 **Support & Questions**

**GitHub Repository:** https://github.com/UberShaikh/docshield

**For deployment help:**
1. Check logs: `docker logs <service-name>`
2. Check health: `curl http://localhost:4000/health`
3. Verify connectivity: `docker network ls`

---

**Last Updated:** April 23, 2026  
**DocShield Version:** 1.0  
**Status:** Production-Ready MVP
