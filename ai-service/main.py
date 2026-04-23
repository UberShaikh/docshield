# ================= IMPORTS =================
import os
import uuid
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
import pytesseract
from pdf2image import convert_from_path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import torch
import torchvision.models as models
import torchvision.transforms as transforms
import torch.nn.functional as F

# ================= APP =================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
HEATMAP_DIR = Path("heatmaps")
UPLOAD_DIR.mkdir(exist_ok=True)
HEATMAP_DIR.mkdir(exist_ok=True)

app.mount("/heatmaps", StaticFiles(directory="heatmaps"), name="heatmaps")

# ================= DEVICE =================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ================= MODELS =================
resnet = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2).to(device)
efficient = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT).to(device)

resnet.eval()
efficient.eval()

# Keep gradients enabled for Grad-CAM even in eval mode
for param in resnet.parameters():
    param.requires_grad = True

# ================= TRANSFORM =================
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

# ================= GRAD-CAM =================
features = []
gradients = []

def forward_hook(module, input, output):
    features.append(output)

def backward_hook(module, grad_in, grad_out):
    gradients.append(grad_out[0])

target_layer = resnet.layer4[-1]
target_layer.register_forward_hook(forward_hook)
target_layer.register_backward_hook(backward_hook)

# ================= AI MODEL =================
def run_ai_model(image):
    try:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb)

        tensor = transform(img).unsqueeze(0).to(device)
        tensor.requires_grad = True

        # 🔥 ResNet
        features.clear()
        gradients.clear()

        with torch.enable_grad():
            out1 = resnet(tensor)
            pred = out1.argmax()
            out1[0, pred].backward()
    except Exception as e:
        print(f"AI Model error: {e}")
        return {"ai_score": 0, "confidence": 0.0, "entropy": 0.0, "tensor": None}

    # 🔥 EfficientNet
    out2 = efficient(tensor)

    probs = F.softmax(out1, dim=1)[0].detach().cpu().numpy()

    confidence = float(np.max(probs))
    entropy = float(-np.sum(probs * np.log(probs + 1e-9)))

    score1 = float(np.std(out1.detach().cpu().numpy()))
    score2 = float(np.std(out2.detach().cpu().numpy()))

    ai_score = int(min(100, (score1 + score2) * 10))

    return {
        "ai_score": ai_score,
        "confidence": confidence,
        "entropy": entropy,
        "tensor": tensor
    }

# ================= REAL GRAD-CAM =================
def generate_heatmap(image):
    try:
        if not gradients or not features:
            return image
        
        grads = gradients[0].detach().cpu().numpy()[0]
        fmap = features[0].detach().cpu().numpy()[0]

        weights = np.mean(grads, axis=(1, 2))
        cam = np.zeros(fmap.shape[1:], dtype=np.float32)

        for i, w in enumerate(weights):
            cam += w * fmap[i]

        cam = np.maximum(cam, 0)

        if cam.max() != 0:
            cam = cam / cam.max()

        cam = cv2.resize(cam, (image.shape[1], image.shape[0]))

        heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(image, 0.6, heatmap, 0.4, 0)

        return overlay
    except Exception as e:
        print(f"Heatmap generation error: {e}")
        return image

# ================= PDF TO IMAGE =================
def convert_pdf_to_image(filepath):
    """Convert first page of PDF to OpenCV image"""
    try:
        pages = convert_from_path(filepath, first_page=1, last_page=1, dpi=200)
        if not pages:
            return None, 1
        
        # Convert PIL Image to OpenCV format
        pil_image = pages[0]
        image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        
        # Get total page count
        total_pages = len(convert_from_path(filepath, dpi=200))
        
        return image, total_pages
    except Exception as e:
        print(f"PDF conversion error: {e}")
        return None, 1

# ================= OCR =================
def run_ocr(image):
    text = pytesseract.image_to_string(image)
    score = 10 if len(text.strip()) < 20 else 0
    return {"text": text, "score": score}

# ================= METADATA =================
def analyze_metadata(filepath):
    return {"score": 10}

# ================= TAMPERING =================
def detect_tampering(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F).var()
    score = int(max(0, 100 - lap))
    return {"score": min(score, 40)}

# ================= ANALYZE =================
def analyze_image(filepath):
    start = time.time()
    page_count = 1
    
    try:
        # Check if PDF
        if filepath.lower().endswith('.pdf'):
            image, page_count = convert_pdf_to_image(filepath)
            if image is None:
                return {
                    "fraud_score": 0,
                    "risk_level": "LOW",
                    "ai_score": 0,
                    "tampering_score": 0,
                    "metadata_score": 0,
                    "ocr_score": 0,
                    "processing_time": round(time.time() - start, 2),
                    "heatmap_url": None,
                    "ocr_text": "",
                    "metadata": {"note": "PDF conversion failed"},
                    "reasons": ["PDF processing error"],
                    "page_count": page_count,
                    "error": "Failed to convert PDF"
                }
        else:
            image = cv2.imread(filepath)
            if image is None:
                return {
                    "fraud_score": 0,
                    "risk_level": "LOW",
                    "ai_score": 0,
                    "tampering_score": 0,
                    "metadata_score": 0,
                    "ocr_score": 0,
                    "processing_time": round(time.time() - start, 2),
                    "heatmap_url": None,
                    "ocr_text": "",
                    "metadata": {"note": "processed"},
                    "reasons": ["Image read failed"],
                    "page_count": page_count,
                    "error": "Failed to read image"
                }

        ocr = run_ocr(image)
        meta = analyze_metadata(filepath)
        tamper = detect_tampering(image)
        ai = run_ai_model(image)

        # 🔥 REAL HEATMAP
        heatmap_img = generate_heatmap(image)

        heatmap_name = f"heatmap_{uuid.uuid4().hex[:8]}.jpg"
        cv2.imwrite(str(HEATMAP_DIR / heatmap_name), heatmap_img)

        # 🔥 FINAL SCORE
        total = ai["ai_score"] + tamper["score"] + meta["score"] + ocr["score"]
        total = int(total / 2)

        if total > 70:
            risk = "HIGH"
        elif total > 40:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        return {
            "fraud_score": total,
            "risk_level": risk,
            "ai_score": ai["ai_score"],
            "tampering_score": tamper["score"],
            "metadata_score": meta["score"],
            "ocr_score": ocr["score"],
            "processing_time": round(time.time() - start, 2),
            "heatmap_url": f"/heatmaps/{heatmap_name}",
            "ocr_text": ocr["text"][:100],
            "metadata": {"note": "processed"},
            "reasons": [
                "ResNet + EfficientNet + Grad-CAM",
                "OpenCV tampering detection"
            ],
            "page_count": page_count
        }
    except Exception as e:
        print(f"Analysis error: {e}")
        return {
            "fraud_score": 0,
            "risk_level": "LOW",
            "ai_score": 0,
            "tampering_score": 0,
            "metadata_score": 0,
            "ocr_score": 0,
            "processing_time": round(time.time() - start, 2),
            "heatmap_url": None,
            "ocr_text": "",
            "metadata": {"note": "error"},
            "reasons": [str(e)],
            "page_count": page_count,
            "error": str(e)
        }

# ================= API =================
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    uid = uuid.uuid4().hex[:8]
    path = str(UPLOAD_DIR / f"{uid}_{file.filename}")

    with open(path, "wb") as f:
        f.write(await file.read())

    return analyze_image(path)

# ================= HEALTH =================
@app.get("/health")
def health():
    return {"status": "ok"}

# ================= ROOT =================
@app.get("/")
def root():
    return {
        "status": "AI Service Running ✅",
        "message": "DocShield AI working 🚀",
        "endpoints": {
            "analyze": "/analyze",
            "docs": "/docs",
            "health": "/health"
        }
    }