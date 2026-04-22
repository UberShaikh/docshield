# ================= BASE =================
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

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

# ================= PORT =================
EXPOSE 8000

# ================= START =================
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]