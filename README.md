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


## Alcance del reclamo

El formulario exige elegir **¿A quién afecta el problema?** antes de enviar:
**Personal: solo me afecta a mí** o **Colectivo: afecta a varias personas**.
Inicialmente muestra **Seleccioná una opción**. Sin seleccion no se registra
al ciudadano ni se envia el reclamo. Ante un error conserva la eleccion y la
vacia despues de un alta exitosa.

La API recibe `alcance: "PERSONAL" | "COLECTIVO"`; las respuestas historicas
pueden incluir `null`. Ambos detalles (vecino y municipal) muestran
**Personal**, **Colectivo** o **Sin especificar**. Las fotos y el resto del alta
conservan su funcionamiento.

Un colectivo recibe 10 puntos adicionales de criticidad calculados por el
backend.
