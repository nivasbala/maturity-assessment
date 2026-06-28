# Task 1: Project Scaffolding — Architecture Diagram

```mermaid
graph TD
    Browser["🖥️ Browser\nlocalhost:8080"]

    subgraph Docker["Docker Compose Network — maturity-assessment_default"]

        subgraph Nginx["nginx (nginx:1.25-alpine) — port 80"]
            NginxConf["nginx/nginx.conf\n/api  → backend:8000\n/     → frontend:5173"]
        end

        subgraph Backend["backend (Python 3.12 / FastAPI) — port 8000"]
            Health["GET /api/health → {status: ok}"]
            Core["app/core/\n  config.py\n  database.py\n  security.py\n  llm_factory.py"]
            Routers["app/routers/\n  auth · admin\n  accounts · assessments · public"]
            Services["app/services/\n  auth · account\n  assessment · question · scoring"]
            Agents["app/agents/\n  research · report · orchestrator"]
            Seed["app/seed/seed_data.py"]
        end

        subgraph Frontend["frontend (Node 20 / Vite) — port 5173"]
            React["React 18 + TypeScript\nTailwind CSS 3.4"]
            Pages["pages/\n  prospect: Landing · PillarSelect · Assessment · Report\n  internal: AccountsList · AccountDetail · ReportDetail\n  admin: Users · Pillars · Questions"]
            ApiClient["src/api/index.ts (Axios)"]
        end

        subgraph Postgres["postgres (postgres:16-alpine) — port 5432"]
            PGData["Volume: postgres_data\nhealthcheck ✅"]
        end

        subgraph Ollama["ollama (ollama/ollama) — port 11434"]
            OllamaData["Default model: llama3.2\nVolume: ollama_data"]
        end

    end

    Browser -->|"HTTP :8080"| Nginx
    Nginx -->|"/api/*"| Backend
    Nginx -->|"/*"| Frontend
    Backend -->|"asyncpg"| Postgres
    Backend -->|"LangChain / LangGraph\n(Task 9)"| Ollama
```

## Services Summary

| Service | Image | Internal Port | Host Port | Purpose |
|---------|-------|--------------|-----------|---------|
| nginx | nginx:1.25-alpine | 80 | **8080** | Reverse proxy — routes traffic to backend and frontend |
| backend | python:3.12-slim | 8000 | — | FastAPI app, business logic, LLM orchestration |
| frontend | node:20-alpine | 5173 | — | React 18 + Vite dev server |
| postgres | postgres:16-alpine | 5432 | — | Primary database |
| ollama | ollama/ollama | 11434 | 11434 | Local LLM server (llama3.2) |

## Notes

- Port **8080** is used instead of 80 because port 80 is held by an SSH tunnel on the host machine.
- Backend and frontend volumes are bind-mounted (`./backend:/app`, `./frontend:/app`) so code changes hot-reload without rebuilding.
- The `llm_factory.py` abstraction allows switching between Ollama, Anthropic, and OpenAI via a single `LLM_PROVIDER` env var — no code changes needed.
- LLM agent wiring (Task 9) is scaffolded but not yet implemented.
```
