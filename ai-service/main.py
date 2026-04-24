from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from torchvision.models import efficientnet_b4, EfficientNet_B4_Weights
import numpy as np
import cv2
from PIL import Image, ImageChops, ImageEnhance
from PIL.ExifTags import TAGS
from pdf2image import convert_from_path
import pytesseract
import uuid, os

app = FastAPI()

UPLOAD_DIR = "uploads"
HEATMAP_DIR = "heatmaps"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(HEATMAP_DIR, exist_ok=True)

device = "cuda" if torch.cuda.is_available() else "cpu"

# ================= MODEL =================
model = efficientnet_b4(weights=EfficientNet_B4_Weights.DEFAULT)
model.classifier[1] = nn.Linear(model.classifier[1].in_features, 2)
model = model.to(device)
model.eval()

# ================= TRANSFORM =================
transform = transforms.Compose([
    transforms.Resize((380, 380)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ================= OCR =================
def extract_text(pil_img):
    try:
        img = np.array(pil_img)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        gray = cv2.threshold(gray, 0, 255,
                             cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

        text = pytesseract.image_to_string(gray, config="--psm 6")
        return text.strip() if text.strip() else ""
    except:
        return ""

# ================= METADATA =================
def metadata_score(pil_img):
    try:
        exif = pil_img._getexif()
        if not exif:
            return 0.8
        return 0.2
    except:
        return 0.8

# ================= WHITE CHECK =================
def white_check(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    ratio = np.sum(gray > 240) / gray.size
    return ratio

# ================= ELA =================
def ela(pil_img):
    temp = "temp.jpg"
    pil_img.save(temp, "JPEG", quality=90)
    comp = Image.open(temp)

    diff = ImageChops.difference(pil_img, comp)
    extrema = diff.getextrema()
    max_diff = max([e[1] for e in extrema])
    scale = 255.0 / max_diff if max_diff else 1

    diff = ImageEnhance.Brightness(diff).enhance(scale)
    return np.array(diff)

# ================= PATCH =================
def patch_analysis(img):
    h, w, _ = img.shape
    scores = []

    for y in range(0, h, 128):
        for x in range(0, w, 128):
            patch = img[y:y+128, x:x+128]
            if patch.shape[0] < 64 or patch.shape[1] < 64:
                continue

            t = transform(Image.fromarray(patch)).unsqueeze(0).to(device)
            with torch.no_grad():
                out = model(t)
                scores.append(torch.softmax(out, 1)[0][1].item())

    return np.mean(scores) if scores else 0

# ================= GRADCAM =================
gradients = None
activations = None

def f_hook(m, i, o):
    global activations
    activations = o

def b_hook(m, gi, go):
    global gradients
    gradients = go[0]

target_layer = model.features[-1]
target_layer.register_forward_hook(f_hook)
target_layer.register_full_backward_hook(b_hook)

def gradcam(tensor):
    model.zero_grad()
    out = model(tensor)
    out[0][1].backward()

    g = gradients.cpu().data.numpy()[0]
    a = activations.cpu().data.numpy()[0]

    w = np.mean(g, axis=(1, 2))
    cam = np.zeros(a.shape[1:], dtype=np.float32)

    for i, wi in enumerate(w):
        cam += wi * a[i]

    cam = np.maximum(cam, 0)
    cam = cam - cam.min()
    cam = cam / (cam.max() + 1e-8)

    return cam

# ================= ANALYZE =================
def analyze_pil(image):
    img_np = np.array(image)
    h, w = img_np.shape[:2]

    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        out = model(tensor)
        prob = torch.softmax(out, 1)[0][1].item()

    patch_prob = patch_analysis(img_np)
    ela_score = np.mean(ela(image)) / 255
    meta = metadata_score(image)
    white = white_check(img_np)

    fraud = (
        prob * 0.4 +
        patch_prob * 0.2 +
        ela_score * 0.1 +
        meta * 0.2 +
        white * 0.1
    ) * 100

    if prob > 0.6:
        fraud += 15

    if white > 0.6:
        fraud += 20

    fraud = min(fraud, 100)

    # ================= HEATMAP =================
    cam = gradcam(tensor)
    cam = cv2.resize(cam, (w, h))

    heat = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(img_np, 0.6, heat, 0.4, 0)

    # ================= BBOX =================
    heat_gray = (cam * 255).astype(np.uint8)
    _, th = cv2.threshold(heat_gray, 120, 255, cv2.THRESH_BINARY)

    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []

    for c in cnts:
        x, y, bw, bh = cv2.boundingRect(c)
        if bw * bh > 1500:
            boxes.append((x, y, bw, bh))
            cv2.rectangle(overlay, (x, y), (x + bw, y + bh), (0, 0, 255), 2)

    name = f"{uuid.uuid4().hex}.jpg"
    path = os.path.join(HEATMAP_DIR, name)
    cv2.imwrite(path, overlay)

    # ================= OCR =================
    ocr_text = extract_text(image)

    # ================= 🔥 FLAGS FIX =================
    flags = []

    if prob > 0.6:
        flags.append("AI model suspects manipulation")

    if patch_prob > 0.5:
        flags.append("Local tampering detected")

    if ela_score > 0.4:
        flags.append("Compression inconsistency found")

    if meta > 0.7:
        flags.append("Metadata missing or stripped")

    if white > 0.6:
        flags.append("Suspicious white background")

    if len(ocr_text) < 10:
        flags.append("Weak OCR text (possible tampering)")

    return {
        "fraud_score": round(fraud, 2),
        "risk_level": "HIGH" if fraud > 65 else "MEDIUM" if fraud > 35 else "LOW",

        "heatmap_url": f"/heatmaps/{name}",

        "ai_score": round(prob, 3),
        "tampering_score": round(patch_prob, 3),
        "ocr_score": round(len(ocr_text) / 100, 3),

        "ocr_text": ocr_text if ocr_text else "No text detected",
        "boxes": boxes,

        "detection_flags": flags
    }

# ================= FILE =================
def analyze_file(path, name):
    if name.lower().endswith(".pdf"):
        pages = convert_from_path(path, first_page=1, last_page=1)
        results = []

        for i, p in enumerate(pages):
            r = analyze_pil(p)
            r["page"] = i + 1
            results.append(r)

        return results[0] if results else {}
    else:
        img = Image.open(path).convert("RGB")
        return analyze_pil(img)

# ================= API =================
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}_{file.filename}")

    with open(path, "wb") as f:
        f.write(await file.read())

    return analyze_file(path, file.filename)

@app.get("/heatmaps/{name}")
def heatmap(name: str):
    file_path = os.path.join(HEATMAP_DIR, name)

    if not os.path.exists(file_path):
        return {"error": "not found"}

    return FileResponse(file_path, media_type="image/jpeg")

@app.get("/health")
def health():
    return {"status": "ok"}