# Contributing to FMS

## Before you start

- Use a feature branch: `feature/<short-description>`.
- Use Node.js 22, Python 3.11, React 18, and Tailwind CSS 3.
- Never commit `.env` files, Supabase keys, JWTs, credentials, customer data, or database exports.
- Use fictional data in local development and test fixtures.

## Quality gate

Before opening a pull request, run:

```powershell
npm run lint
npm test -- --run
npm run build
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend/app backend/tests
.\.venv\Scripts\python.exe -m mypy backend/app
```

## Database changes

- Make schema changes through Alembic migrations only.
- Run migrations with `DIRECT_URL`; application traffic uses `DATABASE_URL`.
- Include a safe downgrade path where practical.
- Preserve `organization_id` filtering and validate resource ownership in every API query.

## Pull requests

- Explain the user-facing behavior and testing performed.
- Include screenshots for UI changes.
- Keep commits focused and avoid unrelated formatting changes.
- Request review before merging to `main`.
