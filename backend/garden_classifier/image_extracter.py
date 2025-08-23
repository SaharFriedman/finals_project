from ultralytics import YOLO
import cv2
# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
import base64
import cv2
import numpy as np
import weatherAPI as WAPI

# model configuration
MODEL_PATH = "my_model.pt"
model = YOLO(MODEL_PATH, task='detect')

PLANT_CLASSES = {"Plant", "Flower"}
CONTAINER_CLASSES = {"Pot", "Raised_Bed", "Garden_Bed", "Grass"}

MIN_IOU = 0.05  # small threshold handles plant-inside-large-bed

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
    area_a = (ax2-ax1)*(ay2-ay1)
    area_b = (bx2-bx1)*(by2-by1)
    return inter / (area_a + area_b - inter + 1e-9)

def normalize_container(lbl):
    return "ground" if lbl in ("Garden_Bed", "Grass") else lbl  # pot/raised_bed/ground

@app.post("/predict")
def predict():
    req = request.files["image"]
    img_bytes = np.frombuffer(req.read(), np.uint8)
    img = cv2.imdecode(img_bytes, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]

    res = model(img)[0]
    names = res.names

    plants, containers = [], []
    for xyxy, cls, conf in zip(res.boxes.xyxy.tolist(),
                               res.boxes.cls.tolist(),
                               res.boxes.conf.tolist()):
        label = names[int(cls)]
        box = clamp(*xyxy, w, h)
        if not box: 
            continue
        rec = {"label": label, "confidence": float(conf), "coords": box}
        if label in PLANT_CLASSES:
            print(label)
            plants.append(rec)
        elif label in CONTAINER_CLASSES:
            containers.append(rec)
            print(label)
        else:
            print(label)
    out = []
    for p in plants:
        best, best_iou = None, 0.0
        for c in containers:
            score = iou(p["coords"], c["coords"])
            if score > best_iou:
                best, best_iou = c, score

        if best and best_iou >= MIN_IOU:
            container = normalize_container(best["label"])
            container_score = best_iou  # or best["confidence"], your choice
        else:
            container, container_score = "unknown", 0.0

        x1,y1,x2,y2 = p["coords"]
        crop = img[y1:y2, x1:x2]
        out.append({
            "label": p["label"],
            "confidence": p["confidence"],
            "coords": p["coords"],
            "image": encode_b64(crop),
            "container": container,
            "container_score": container_score
        })

    # No need to return raw container boxes anymore
    return jsonify({"image": out})

@app.route("/weather", methods=["POST"])
def weather():
    data = request.get_json()  # parse JSON body
    lat = data.get("latitude")
    lon = data.get("longitude")
    weather_string = str(lat) + "," + str(lon)
    weatherJSON = WAPI.start(weather_string,0)
    return weatherJSON
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=2021, debug=False)

#=============================================================================#
# print(results[0].to_json())