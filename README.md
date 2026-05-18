# Legal AI — Generative UI con RAG

Monorepo para evaluación legal mediante IA generativa. Arquitectura basada en RAG (Retrieval-Augmented Generation) con interfaz de usuario generativa.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14+ (App Router, TypeScript, Tailwind) |
| Backend | FastAPI + LangGraph |
| Vector DB | Qdrant (autoalojado via Docker) |
| Modelos IA | Google AI Studio — Gemini |

## Arquitectura

```
Browser → Next.js (frontend/) → FastAPI (backend/) → LangGraph Agent
                                                           ↓
                                                   Qdrant (vector search)
                                                           ↓
                                                   Gemini (Google AI Studio)
```

## Comandos

### 1. Levantar Qdrant con Docker

```bash
docker-compose up -d
```

Qdrant queda disponible en `http://localhost:6333`.  
Dashboard en `http://localhost:6333/dashboard`.

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API disponible en `http://localhost:8000`.  
Docs interactivos en `http://localhost:8000/docs`.

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

App disponible en `http://localhost:3000`.

### 4. Ingesta de documentos

```bash
cd ingesta_datos
pip install -r requirements.txt
python cargar_leyes.py
```

## Variables de entorno

Crea un archivo `.env` en `backend/` con:

```env
GOOGLE_API_KEY=tu_clave_de_google_ai_studio
QDRANT_URL=http://localhost:6333
COLLECTION_NAME=leyes_argentinas
```
