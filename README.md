# Ticketera municipal — frontend

Pantalla simple para probar el backend de `ticketera`: alta de reclamos como vecino y panel de administración (reclamos, cuadrillas, resumen de IA, ciudadano y SOAP).

## Cómo correrlo

El backend tiene que estar en el puerto 8080 (`docker compose up` dentro de `ticketera`).

```bash
cd frontend
npm install
npm run dev
```

Abrí http://localhost:5173. Vite reenvía `/api` a `http://localhost:8080`, así que no hace falta configurar CORS.

- La app abre en el login. Un email `@admin.com` entra al panel municipal; cualquier otro, a la vista del vecino.
