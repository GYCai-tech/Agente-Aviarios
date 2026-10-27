# Estudio de nave — Gómez y Crespo

Herramienta interna para preparar propuestas comerciales de **Nidal Colectivo A-Nida** y
**Aviario Industrial**: a partir de los datos de la nave calcula capacidad, densidad, yacija y
cumplimiento normativo, y genera el plano (SVG, DXF y PDF).

## Arranque local

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
BACKEND_URL=http://localhost:8000 npm run dev
```

O con Docker: `docker compose up -d --build` (frontend en :3000, backend en :8080).

## Tests

```bash
python -m pytest test_calculos_capacidad.py test_nidal_calculo_modelo.py
```

Más detalle en [CLAUDE.md](CLAUDE.md).
