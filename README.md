# 🌱 MyGarden Project

A full-stack interactive gardening assistant built with React, Node.js, Python (YOLO model), and MongoDB.  
This project was designed as a final project by **Sahar Friedman** and **Adar Kliger**.

---

## 🚀 Run Instructions

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

## 👩‍💻 Authors
- Sahar Friedman
- Adar Kliger
