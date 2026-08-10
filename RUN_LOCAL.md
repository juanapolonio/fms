# Run Locally After Extracting the Full ZIP

This guide assumes the ZIP was extracted completely. Keep the `.env` private because it contains database credentials.

## 1. Install the required runtimes

Install these once if they are not already available:

- Node.js **22 LTS**: <https://nodejs.org/>
- Python **3.11**: <https://www.python.org/downloads/>

Open **Command Prompt** and verify them:

```cmd
node --version
npm --version
py -3.11 --version
```

## 2. Open the extracted project

Replace the path below with the folder where the ZIP was extracted:

```cmd
cd /d C:\Projects\fms
dir
```

You should see `package.json`, `backend`, and `src`. Create a private `.env` if it was not included in the ZIP.

## 3. Install or refresh dependencies

Run these commands even when `node_modules` and `.venv` were included in the ZIP. They make the project portable to the recipient's computer.

```cmd
npm install
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -e "backend[dev]"
```

## 4. Apply the database schema and starter data

Run migrations against the session-mode `DIRECT_URL`, then seed realistic persisted rows if the ARGO organization is empty:

```cmd
cd /d C:\Projects\fms
set PYTHONPATH=backend
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe -m app.seed
```

## 5. Start the backend API

Open a new Command Prompt window and run:

```cmd
cd /d C:\Projects\fms
set PYTHONPATH=backend
.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

Leave that window open. Confirm the API works in another Command Prompt:

```cmd
curl http://127.0.0.1:8000/api/marketplace/health
```

## 6. Start the frontend

Open another Command Prompt window and run:

```cmd
cd /d C:\Projects\fms
npm run dev -- --host 127.0.0.1 --port 5174
```

Open the application:

```cmd
start http://127.0.0.1:5174
```

The frontend is intentionally API-backed. Start the backend before opening the UI; there is no in-memory demo fallback.

## If port 5174 is already in use

Run the frontend on another port, for example 5175:

```cmd
npm run dev -- --host 127.0.0.1 --port 5175
start http://127.0.0.1:5175
```
