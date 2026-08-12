# TRAZO PY — primera tienda

Tienda web liviana para vender remeras personalizadas por WhatsApp. No necesita base de datos ni servidor pago.

## Antes de publicar

1. Abrí `app.js` y reemplazá `595981000000` por tu WhatsApp real (código 595, sin `+` y sin el cero inicial).
2. Cambiá el nombre, precios y modelos en el bloque `STORE` del mismo archivo.
3. Reemplazá los enlaces `#` de Instagram, TikTok y Facebook en `index.html`.
4. Revisá la tabla de talles, tiempos y política de cambios antes de aceptar pedidos.

## Probar

Abrí `index.html` en el navegador. Para publicarla gratis, podés subir estos archivos a GitHub Pages, Cloudflare Pages o Vercel.

## Activar Pagopar en Netlify

1. Verificá tu comercio en Pagopar y entrá a **Integrar con mi sitio web**.
2. En Netlify agregá `PAGOPAR_PUBLIC_KEY` y `PAGOPAR_PRIVATE_KEY` en **Environment variables**. Nunca pegues la clave privada en `app.js`.
3. Agregá `SHIPPING_PRICE` con el costo de envío en guaraníes; de forma provisoria se usan Gs. 25.000.
4. En Pagopar configurá estas direcciones, reemplazando `tudominio.com`:
   - Resultado: `https://tudominio.com/resultado-pago`
   - Respuesta: `https://tudominio.com/.netlify/functions/pagopar-webhook`
5. Probá primero con claves de desarrollo. Una vez aprobado, solicitá el pase a producción y reemplazá las variables.

El servidor recalcula los precios, genera el token solicitado por Pagopar y mantiene la clave privada fuera del navegador.
