# ================= BASE =================
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV OMP_NUM_THREADS=1

# ================= SYSTEM DEPENDENCIES =================
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ================= WORKDIR =================
WORKDIR /app

# ================= PYTHON DEPENDENCIES =================
COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ================= COPY PROJECT =================
COPY . .

# ================= CREATE DIR =================
RUN mkdir -p uploads heatmaps

# ================= PRELOAD AI MODELS =================
RUN python - <<EOF
import torchvision.models as models

# preload stronger models
models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
models.efficientnet_b4(weights=models.EfficientNet_B4_Weights.DEFAULT)

print("✅ Models cached")
EOF

# ================= PORT =================
EXPOSE 8000

# ================= START =================
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]