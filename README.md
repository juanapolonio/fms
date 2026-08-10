# ARGO Marketplace Food Ordering System

A multi-tenant restaurant operations module for the ARGO Marketplace platform. It provides catalog administration, order-channel operations, kitchen workflow, payments, discounts, cancellations, and live sales reporting.

## Product scope

- ARGO-provided JWT authentication and organization-scoped RBAC.
- No login or logout page in this module.
- Dashboard, Settings, and Users remain intentional placeholders.
- The UI reads and mutates the organization-scoped ARGO dataset through the FastAPI REST API.
- An optional idempotent seed command creates realistic starter records in the configured PostgreSQL database.
- One shared client data model keeps order, kitchen, payment, cancellation, and report events synchronized.

## Technology

- Frontend: Node.js 22, React 18, Vite 7, Tailwind CSS 3, React Router 6, Zustand, React Query, Recharts.
- Backend: Python 3.11, FastAPI, SQLAlchemy 2, Alembic, Pydantic 2.
- Data: PostgreSQL 14-compatible Supabase Postgres with UUID primary keys and JSONB for structured order metadata.

## Local development

Install frontend dependencies and start the UI:

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Install backend dependencies with Python 3.11:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"
```

Copy the redacted environment example and provide values locally. Do not commit this file. Use SQLAlchemy's `postgresql+psycopg2` URL without Supabase's `pgbouncer=true` query option:

```powershell
Copy-Item backend\.env.example .env
```

Run database migrations using the session-mode `DIRECT_URL`:

```powershell
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.seed
```

Run the API:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

The API base path is `/api/marketplace`; its health check is `/api/marketplace/health`. The frontend uses the API by default; it does not fall back to in-memory rows when the API is unavailable.

## Security and configuration

- Keep `DATABASE_URL`, `DIRECT_URL`, JWT secrets, Supabase keys, and service-role credentials only in ignored environment files or CI secrets.
- Use the transaction-mode pooler for `DATABASE_URL` and the session-mode pooler for `DIRECT_URL` migrations.
- The service-role token must never be included in the browser bundle or a `VITE_*` variable.
- Never put the Supabase service-role key, database password, or a privileged ARGO token in the frontend or any `VITE_*` variable.
- In non-development environments, the API rejects requests without an ARGO bearer token.
- Every persistent business table is scoped by `organization_id`; API queries use the ARGO organization claim.

## Deployment

- `render.yaml` describes the FastAPI service, migration, and optional starter-data command for Render.
- `vercel.json` describes the Vite build and SPA fallback for Vercel.
- Set `DATABASE_URL`, `DIRECT_URL`, `ARGO_JWT_SECRET`, and `CORS_ORIGINS` as Render secrets/environment variables.
- Set `VITE_API_BASE_URL` in Vercel to the deployed Render API URL plus `/api/marketplace`.
- Production requests are expected to carry the ARGO platform JWT; the module intentionally has no local login or logout UI.

## Quality checks

```powershell
npm run lint
npm test -- --run
npm run build
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend/app backend/tests
.\.venv\Scripts\python.exe -m mypy backend/app
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Never include credentials, real customer data, or database dumps in commits.

## License

Distributed under the [MIT License](LICENSE).
