🌱 Finals Project – Smart Garden Assistant

Welcome to **MyGarden** – a fun, interactive project that combines computer vision, Node.js, and a React frontend to help manage your garden.  
It’s our final project, built with love, some sleepless nights, and lots of plants 🌿.

## What it does
- Detects plants in your photos using YOLO models.
- Provides an interactive web UI to explore your garden.
- Hooks into a Python microservice for image recognition (and optional weather data).
- Stores garden info in MongoDB.
 by **Sahar Friedman** and **Adar Kliger**.

---

## Run Instructions

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>/server-client/finals_project
```

### 2. Install Docker & Docker Compose
- [Install Docker Desktop](https://docs.docker.com/get-docker/) (includes Docker Compose).
- Make sure Docker is running before continuing.

### 3. Build and start the project
```bash
docker compose up -d --build
```

This will start the following services:
- **frontend** → React app (default on `http://localhost:3000`)
- **backend** → Node.js API + WebSocket server (default on `http://localhost:12345`)
- **pyserver** → Python YOLO model server (default on `http://localhost:2021`)
- **mongodb** → MongoDB database (default on `mongodb://localhost:27017`)

### 4. Access the app
- Open your browser at: **[http://localhost:3000](http://localhost:3000)**
- Backend API: [http://localhost:12345](http://localhost:12345)
- Python model API (direct): [http://localhost:2021](http://localhost:2021)
- MongoDB: connect via MongoDB Compass using
  ```
  mongodb://localhost:27017
  ```

### 5. Stop the project
```bash
docker compose down
```

---

## ⚠️ Notes
- The first run may take a while since Docker installs all dependencies and downloads the YOLO model.
- If you change `Dockerfile` or dependencies, rebuild with:
  ```bash
  docker compose build
  ```
- If a port (3000, 12345, or 2021) is already in use on your system, adjust it in `docker-compose.yml`.

---
## Project Structure
Here’s the file tree (base is `finals_project/`):

```
backend/
 ├─ app.js                  # Main Node.js backend server
 ├─ controllers/            # Backend controllers
 ├─ middleware/             # Express middleware
 ├─ models/                 # Mongoose models
 ├─ routes/                 # Express routes
 ├─ services/               # Service logic
 ├─ uploads/                # Photo uploads
 └─ garden_classifier/      
     ├─ image_extracter.py  # Python Flask server for YOLO plant detection
     ├─ weatherAPI.py       # (Optional) weather and sun data API
     ├─ requirements.txt    # Python dependencies
     └─ models/             
         ├─ my_model.pt             # YOLO trained model
         └─ specific_plant_model.pt # Specialized plant model

frontend/
 ├─ src/
 │   ├─ App.js              # Main React app
 │   ├─ App.css             # Global styles
 │   ├─ index.js            # React entry point
 │   ├─ api/                # API calls to backend
 │   ├─ art/                # UI art and assets
 │   ├─ auth/               # Auth context and helpers
 │   ├─ components/         # React components
 │   └─ pages/             
 │       ├─ Home.js
 │       ├─ MyGarden.js
 │       ├─ MyHelper.js
 │       └─ Welcome.js

docker-compose.yml          # Compose stack: frontend, backend, python server
.env                        # Environment variables
README.md                   # You’re reading it 😉
```
## 👩‍💻 Authors
- Sahar Friedman
- Adar Kliger
Happy gardening! 
