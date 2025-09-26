from ultralytics import YOLO
import cv2
# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
import base64
import numpy as np
import weatherAPI as WAPI

# model configuration
MODEL_PATH = "/models/my_model.pt"
SPECIFIC_MODEL = "/models/specific_plant_model.pt"
model = YOLO(MODEL_PATH, task='detect')
scnd_model = YOLO(SPECIFIC_MODEL,task='detect')

PLANT_CLASSES_N     = {"plant", "flower", "tree","cactus"}
CONTAINER_CLASSES_N = {"pot", "raised_bed", "garden_bed", "grass"}

PLANT_MIN_CONF = 0.60           # weight for object detection
MIN_IOU        = 0.05            # weight for container inferr
PRED_CONF_KEEP_ALL = 0.001       
SCND_MIN_CONF = 0.90              # weight for plant detection
def encode_b64(img):
    ok, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf).decode("utf-8") if ok else ""

def clamp(x1,y1,x2,y2,w,h):
    x1 = max(0, min(int(x1), w-1)); x2 = max(0, min(int(x2), w-1))
    y1 = max(0, min(int(y1), h-1)); y2 = max(0, min(int(y2), h-1))
    return None if x2<=x1 or y2<=y1 else [x1,y1,x2,y2]

def iou(a,b):
    ax1,ay1,ax2,ay2 = a; bx1,by1,bx2,by2 = b
    ix1, iy1 = max(ax1,bx1), max(ay1,by1)
    ix2, iy2 = min(ax2,bx2), min(ay2,by2)
    iw, ih = max(0, ix2-ix1), max(0, iy2-iy1)
    inter = iw*ih
    if inter == 0: return 0.0
    area_a = (ax2-ax1)*(ay2-ay1); area_b = (bx2-bx1)*(by2-by1)
    return inter / (area_a + area_b - inter + 1e-9)

# ---- label helpers ----
def norm_label(lbl: str) -> str:
    """lowercase + unify separators + simple synonyms"""
    s = (lbl or "").strip().lower().replace(" ", "_").replace("-", "_")
    synonyms = {
        "potted_plant": "plant",
        "plant_pot":    "pot",
        "raised-bed":   "raised_bed",
        "garden-bed":   "garden_bed",
        "gardenbed":    "garden_bed",
        "lawn":         "grass",
    }
    return synonyms.get(s, s)
RAW_SCND_CLASSES = [
    "Basil", "Geranium", "Jasmine",  
    "Lavender", "Lemon", "Olive", "Orange", "Parsley", "Peppermint"
]
SCND_CLASSES_N = { norm_label(x) for x in RAW_SCND_CLASSES }
def canonical_container(lbl_n: str) -> str:
    """emit the 4 UI values you want to use everywhere"""
    if lbl_n in {"garden_bed", "grass"}:
        return "ground"
    if lbl_n in {"pot", "raised_bed"}:
        return lbl_n
    return "unknown"

@app.post("/predict")
def predict():
    req = request.files["image"]
    img_bytes = np.frombuffer(req.read(), np.uint8)
    img = cv2.imdecode(img_bytes, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]

    # Keep everything from the model; we will filter plants only.
    res = model.predict(img, conf=PRED_CONF_KEEP_ALL, verbose=False)[0]
    names = res.names

    plants, containers = [], []
    for xyxy, cls, conf in zip(res.boxes.xyxy.tolist(),
                               res.boxes.cls.tolist(),
                               res.boxes.conf.tolist()):
        label_raw = names[int(cls)]
        label_n   = norm_label(label_raw)
        box = clamp(*xyxy, w, h)
        if not box:
            continue

        conf = float(conf)
        rec  = {"label_raw": label_raw, "label_n": label_n, "confidence": conf, "coords": box}

        if label_n in PLANT_CLASSES_N:
            if conf < PLANT_MIN_CONF:    # plants threshold 0.70
                continue
            plants.append(rec)

        elif label_n in CONTAINER_CLASSES_N:
            # no confidence filter for containers
            containers.append(rec)

    out = []
    for p in plants:
        best, best_iou = None, 0.0
        for c in containers:
            score = iou(p["coords"], c["coords"])
            if score > best_iou:
                best, best_iou = c, score

        if best and best_iou >= MIN_IOU:
            container = canonical_container(best["label_n"])  # pot / raised_bed / ground
            container_score = best_iou
        else:
            container, container_score = "unknown", 0.0

        x1,y1,x2,y2 = p["coords"]
        crop = img[y1:y2, x1:x2]
        
        lbl_n = p.get("label_n") or norm_label(p.get("label", ""))

        if lbl_n == "cactus":
    # skip the species model and hard-set species as cactus
            species_raw, species_n, species_conf = "Cactus", "cactus", 1.0  # or 0.0 if you prefer
        else:
            species_raw, species_n, species_conf = identify_species(crop)
        out_label = species_raw or p["label_raw"]
        out.append({
            # primary plant detection
            "label": out_label,
            "confidence": p["confidence"],
            "coords": p["coords"],
            "image": encode_b64(crop),
            "container": container,
            "container_score": container_score,
            # secondary species classification
            "species_label": species_raw,
            "species_label_n": species_n,
            "species_confidence": species_conf
        })

    return jsonify(out)
def identify_species(crop_bgr: np.ndarray):
    if scnd_model is None or crop_bgr is None or crop_bgr.size == 0:
        return None, None, 0.0

    # predict on the crop
    res = scnd_model.predict(crop_bgr, conf=SCND_MIN_CONF, verbose=False)[0]
    names = res.names
    best = None
    best_conf = -1.0
    for xyxy, cls, conf in zip(res.boxes.xyxy.tolist(),
                               res.boxes.cls.tolist(),
                               res.boxes.conf.tolist()):
        raw = names[int(cls)]
        n   = norm_label(raw)
        if n in SCND_CLASSES_N:
            c = float(conf)
            if c > best_conf:
                best = (raw, n, c)
                best_conf = c
    if best is None:
        return None, None, 0.0
    return best

@app.route("/weather", methods=["POST"])
def weather():
    data = request.get_json()  # parse JSON body
    lat = data.get("latitude")
    lon = data.get("longitude")
    weather_string = str(lat) + "," + str(lon)
    weatherJSON = WAPI.start(weather_string,0)
    return weatherJSON
if __name__ == "__main__":
    import os
    port = int(os.getenv("PY_PORT", "2021"))
    app.run(host="0.0.0.0", port=port, debug=False)