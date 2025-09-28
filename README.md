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

### 2. Install Docker & MongoDB
- [Install Docker Desktop](https://docs.docker.com/get-docker/) (includes Docker Compose).  
- Make sure Docker is running before continuing.

#### MongoDB
This project expects a running MongoDB server on your local machine.

1. [Download MongoDB Community Server](https://www.mongodb.com/try/download/community) and install it.  
   - During setup, enable it as a Windows service so it starts automatically.  
   - By default it listens on `mongodb://127.0.0.1:27017`.

2. (Optional but recommended) Install [MongoDB Compass](https://www.mongodb.com/try/download/compass) if you want a GUI to view your data.  
   - **Note**: Compass is not required for the app to run. The backend connects directly to MongoDB.

3. Make sure MongoDB is running before you start the app. You can check with:
   ```powershell
   netstat -ano | findstr ":27017"

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
### 🚨 if you cannot sign up or log in please view this section.  
### Handling Blocked Ports

By default, the services in this project try to bind to the following ports on your machine:

- **Frontend**: `3000`
- **Backend**: `12345`
- **Python server**: `2021`
- **MongoDB**: `27017` (when using a local MongoDB)

If you see an error like:

Error response from daemon: Ports are not available: exposing port TCP 0.0.0.0:12345 -> 0.0.0.0:12345: listen tcp 0.0.0.0:12345: bind: An attempt was made to access a socket in a way forbidden by its access permissions.  
it means that port is already in use.  
#### How to fix

1. **Find what is using the port**
   ```powershell
   netstat -ano | findstr ":12345"  
2.Note the last column (PID), then check which program it belongs to.  
3. change the second PID to the relevant one when writing: tasklist /FI "PID eq PID".  
4.re run the program with docker compose up -d --build or docker compose up -d --build frontend/backend/pyserver depends on the blocked port.  
   
## ⚠️ Notes
- The first run may take a while since Docker installs all dependencies and downloads the YOLO model.
- If you change `Dockerfile` or dependencies,rebuild with
  ```bash
  docker compose build
  ```
- If a port (3000, 12345, or 2021) is already in use on your system and cannot be change, adjust it in `docker-compose.yml` and on files that contact the servers.

---
## Project Structure

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
