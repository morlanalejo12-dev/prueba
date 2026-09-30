# Lanzamiento de Contracorriente (v1.0)

El juego ya está listo para lanzarse en la web: se abre desde un link, no hay que descargar nada y se puede instalar como app desde el navegador. Lo que falta son cosas que necesitan **tus cuentas, tus datos o un pago**. Están en orden. Cada paso funciona solo: si salteás uno, el juego sigue andando sin esa función.

## Resumen de costos

| Qué | Para qué | Costo |
| --- | --- | --- |
| Dominio (`contracorriente.com` o `.com.ar`) | Una dirección propia y fácil de recordar | **USD 10–15 por año** (.com) · `.com.ar` ≈ ARS 10.000 por año en NIC Argentina |
| Render, plan Starter | Servidor siempre despierto (el plan gratis tarda ~30 s en despertar) | **USD 7 por mes** (el plan gratis sirve para empezar) |
| Supabase | Base de datos de cuentas, progreso y compras | **Gratis** hasta 500 MB (sobra para miles de jugadores). Pro: USD 25 por mes, solo si crece mucho |
| Resend | Emails de “olvidé mi contraseña” | **Gratis** hasta 3.000 emails por mes |
| Google (inicio de sesión) | Botón “Continuar con Google” | **Gratis** |
| Mercado Pago | Cobrar en Argentina (pesos) | **Sin costo fijo.** Comisión por venta ≈ 4–7 % + IVA, según el plazo en que retires el dinero |
| dLocal Go | Cobrar en 12 países de Latinoamérica en su moneda (Pix, OXXO, PSE, tarjetas…) | **Sin costo fijo.** Comisión por venta ≈ 2–6 % según país y medio |
| PayPal | Cobrar en todo el mundo (dólares o euros), con o sin cuenta PayPal | **Sin costo fijo.** Comisión ≈ 5,4 % + US$ 0,30 por venta internacional |
| Cloudflare (opcional) | DNS y protección | **Gratis** |
| Abogado | Revisar términos, privacidad y reembolsos | **Pago único**, variable (consultá presupuesto) |
| Contador / monotributo | Facturar las ventas | Según tu categoría de monotributo |
| Licencia de la canción DKO | Usar la música con derechos (si no es tuya) | Variable, según el acuerdo |

**Total mínimo para lanzar:** solo el dominio, ≈ **USD 12 por año**, con Render gratis (la primera visita tarda ~30 s).
**Recomendado:** dominio y Render Starter ≈ **USD 7 por mes + USD 12 por año ≈ USD 100 por año**. Todo lo demás es gratis hasta que el juego crezca, más la comisión de Mercado Pago sobre lo que vendas.

## Paso a paso

### 1. Pasar la versión nueva a la rama principal
En GitHub, abrí un *Pull request* de `claude/keen-sagan-7ysipr` a `main` y hacé *Merge*. En Render → tu servicio → *Settings → Branch*, fijate que diga `main`. Cada cambio en `main` se publica solo.

### 2. Base de datos permanente (Supabase, gratis) · imprescindible
Sin esto, las cuentas y el progreso se borran en cada actualización. **Si ya tenés el proyecto de Supabase creado**, solo verificá que exista la tabla `kv` (paso 2) y que las dos variables del paso 4 estén cargadas en Render. La versión 1.1 no necesita tablas nuevas: amigos, solicitudes y órdenes de pago se guardan en la misma tabla.
1. Creá un proyecto en [supabase.com](https://supabase.com). Elegí la región São Paulo, que es la más cercana.
2. En *SQL Editor* ejecutá:
   ```sql
   create table kv (ns text, key text, value jsonb, updated timestamptz default now(), primary key (ns, key));
   alter table kv enable row level security;
   ```
   La segunda línea bloquea el acceso público. El servidor usa la clave privada, así que sigue funcionando.
3. En *Project Settings → API* copiá la **Project URL** y la **service_role key** (es secreta: no la compartas).
4. En Render → *Environment*, cargá `SUPABASE_URL` y `SUPABASE_KEY` con esos valores.

### 3. Tu dirección pública
1. En Render → *Environment*, cargá `PUBLIC_URL` = `https://contracorriente.onrender.com`. Si comprás un dominio, poné el tuyo.
2. **Si comprás dominio:** en Render → *Settings → Custom Domains*, agregalo y copiá los registros DNS que te muestra donde compraste el dominio (o en Cloudflare). El certificado HTTPS es automático y gratis.
3. Después de cambiar `PUBLIC_URL`, hacé *Manual Deploy* para que los links para compartir y el mapa del sitio usen la dirección nueva.

### 4. Panel de estadísticas
Render genera la variable `ADMIN_KEY` sola: la ves en *Environment*. Entrá a `https://tu-direccion/admin` y usala para ver jugadores, retención D1/D7, dónde muere la gente y qué secciones abren.
Si tu servicio se creó antes de este cambio, agregá `ADMIN_KEY` a mano con una clave larga.

### 5. “Continuar con Google” (gratis, opcional)
1. En [console.cloud.google.com](https://console.cloud.google.com), creá un proyecto. Andá a *APIs y servicios → Pantalla de consentimiento de OAuth*, elegí *Externo* y completá el nombre, tu email y los links a `/privacidad` y `/terminos`.
2. En *Credenciales → Crear credenciales → ID de cliente de OAuth*, elegí el tipo *Aplicación web*. En *Orígenes autorizados de JavaScript* poné tu `PUBLIC_URL`.
3. Copiá el *ID de cliente* (termina en `.apps.googleusercontent.com`) en Render → `GOOGLE_CLIENT_ID`. El botón aparece solo.

### 6. Emails para recuperar la contraseña (Resend, gratis, opcional)
1. Creá una cuenta en [resend.com](https://resend.com). Si tenés dominio, verificalo en *Domains* agregando los registros DNS que te indica.
2. Creá una *API Key* y cargala en Render → `RESEND_API_KEY`.
3. Cargá `MAIL_FROM`, por ejemplo `Contracorriente <hola@tudominio.com>`.
Sin esto, quien olvide la contraseña puede entrar con Google o con su código de recuperación (Ajustes).

### 7. Cobrar: tres medios de pago (cada uno se activa solo al cargar sus claves)
El juego muestra los precios en la moneda del país que elige el jugador (se adivina solo y se cambia en **Ajustes → País e idioma**). Al comprar, el jugador ve los medios disponibles para su país con el monto exacto de cada uno. Solo compran quienes tienen cuenta con email, para que no pierdan lo que pagaron.

**Precios** (base en dólares, ajustados al poder de compra de cada país y redondeados a precios lindos):

| Artículo | EE. UU. / otros | Argentina | Brasil | México | Chile |
| --- | --- | --- | --- | --- | --- |
| Pack de Inicio (una vez: skin + estela legendarias + 1.500 destellos) | US$ 0,99 | $ 719 | R$ 2,90 | $ 9 | $ 649 |
| Pase Premium | US$ 3,99 | $ 2.899 | R$ 12,90 | $ 49 | $ 2.590 |
| Skin Legendaria / Mítica | US$ 1,99 / 2,99 | $ 1.399 / 2.199 | R$ 5,90 / 9,90 | $ 29 / 39 | $ 1.290 / 1.990 |
| Pack Mítico (−29 %) | US$ 5,99 | $ 4.299 | R$ 18,90 | $ 79 | $ 3.890 |
| Pack Legendario (−36 %) | US$ 6,99 | $ 5.099 | R$ 22,90 | $ 89 | $ 4.590 |
| Colección Completa (−44 %) | US$ 12,99 | $ 9.399 | R$ 41,90 | $ 169 | $ 8.490 |

Los precios en pesos usan una cotización de referencia (1 US$ = 1.450 ARS). Cuando cambie el dólar, cargá en Render la variable `FX_ARS` con la cotización nueva (lo mismo con `FX_BRL`, `FX_CLP`, `FX_MXN`, etc.). Los precios se recalculan solos.

**a) Mercado Pago (Argentina, en pesos)**
1. En [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers) → *Tus integraciones → Crear aplicación* (producto *Checkout Pro*).
2. Probá primero con el *Access Token de prueba* en `MP_ACCESS_TOKEN` y una tarjeta de prueba; después cambialo por el de producción.
3. En la aplicación → *Webhooks*: `https://tu-direccion/api/pay/webhook`, evento *Pagos*.

**b) dLocal Go (Brasil, México, Chile, Colombia, Perú, Uruguay, Paraguay, Bolivia, Ecuador, Costa Rica, Guatemala y Argentina, en moneda local)**
1. Creá una cuenta en [dlocalgo.com](https://dlocalgo.com) (acepta vendedores de Argentina; te pide datos fiscales y una cuenta bancaria para cobrar).
2. En *Integraciones → API*, copiá la *API Key* y la *Secret Key* en `DLOCAL_API_KEY` y `DLOCAL_SECRET_KEY`.
3. Para probar, usá las claves del modo sandbox y agregá `DLOCAL_SANDBOX` = `1`. Cuando funcione, cambiá a las claves reales y borrá esa variable.
4. El aviso de pago se configura solo en cada compra (`/api/pay/dlocal`).

**c) PayPal (todo el mundo, en dólares o euros; se puede pagar con tarjeta sin cuenta PayPal)**
1. Necesitás una cuenta **PayPal Business** (se crea gratis y se puede abrir desde Argentina).
2. En [developer.paypal.com](https://developer.paypal.com) → *Apps & Credentials* → *Create App*. Copiá *Client ID* y *Secret* en `PAYPAL_CLIENT_ID` y `PAYPAL_SECRET`.
3. Para probar, usá las credenciales *Sandbox* y agregá `PAYPAL_SANDBOX` = `1`; después pasá a *Live* y borrá esa variable.
4. No hace falta configurar webhooks: el cobro se confirma cuando el jugador vuelve al juego.

Con uno solo ya se puede vender. Recomendado: **Mercado Pago + PayPal** para empezar (Argentina y el mundo) y sumar **dLocal Go** cuando haya jugadores de Brasil o México.

### 8. Textos legales · antes de cobrar
Las páginas `/terminos`, `/privacidad`, `/reembolsos` y `/arrepentimiento` ya están publicadas, pensadas para Argentina (Ley 24.240, derecho de arrepentimiento de 10 días, botón de arrepentimiento y Ley 25.326).
1. En `scripts/legal.mjs`, completá lo marcado con `[COMPLETAR]`: titular (nombre o razón social), email de contacto y proveedores. Después corré `node scripts/legal.mjs`, o pedímelo y lo hago.
2. **Hacelas revisar por un abogado** antes de activar los pagos.
3. Cuando llegue un pedido de arrepentimiento al email de contacto, respondé con un número de trámite dentro de las 24 h y hacé la devolución desde Mercado Pago.
4. Si vas a recibir datos de muchas personas, registrá la base en la Agencia de Acceso a la Información Pública (es gratis).

### 9. Música
Si la canción DKO no es tuya, conseguí la licencia o el permiso por escrito antes del lanzamiento público. Si no, se puede reemplazar por los temas generados por el juego, que son propios.

### 10. Día del lanzamiento
- Abrí el link desde un celular y una PC. Creá una cuenta, jugá, cerrá sesión y volvé a entrar.
- Compartí el link: se ve con imagen y descripción en WhatsApp, redes y Discord.
- Revisá `/admin` cada día la primera semana. Si mucha gente muere “antes de la 1.ª” bifurcación, el comienzo está muy difícil.
