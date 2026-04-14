# WalletClub — Sistema de Pagos con Tarjeta
## MercadoPago Marketplace + Suscripciones

> Versión 1.1 — Abril 2026
> Implementación Checkout Pro + Webhook automático

---

## 0. Implementación actual (LUM Wellness Club)

Esta sección documenta lo que **ya está funcionando** en producción (Railway).

### 0.1 Arquitectura implementada

| Componente | Detalle |
|------------|---------|
| Método de pago | **Checkout Pro** (redirect a MercadoPago) |
| Flujo | Cliente elige plan → crea orden → redirect a MP → paga → webhook activa membresía |
| Credenciales | Prueba (`APP_USR-` sandbox MX) |
| Backend | Express + TypeScript en Railway (`backend-production-70b6.up.railway.app`) |
| Frontend | React + Vite en Railway (`frontend-production-756b.up.railway.app`) |
| Base de datos | PostgreSQL en Railway |

### 0.2 Credenciales configuradas

**Railway (backend service):**
```
MP_ACCESS_TOKEN=APP_USR-4291489784112478-040712-fd81ada6e0ea26802f980a7b47502cd7-3044195478
MP_PUBLIC_KEY=APP_USR-7c287125-a53c-45e5-8e5e-f439f5d1c7c7
```

**Base de datos (`system_settings` → `mercadopago_config`):**
```json
{
  "public_key": "APP_USR-7c287125-a53c-45e5-8e5e-f439f5d1c7c7",
  "access_token": "APP_USR-4291489784112478-040712-fd81ada6e0ea26802f980a7b47502cd7-3044195478",
  "api_url": "https://backend-production-70b6.up.railway.app",
  "frontend_url": "https://frontend-production-756b.up.railway.app",
  "webhook_secret": "",
  "statement_descriptor": "WALLETCLUB"
}
```

**Usuario de prueba para sandbox:**
- Usuario: `TESTUSER8459322986235353029`
- Contraseña: `mKYqgEOps0`
- Código de verificación: `195478`

### 0.3 Archivos clave del backend

| Archivo | Responsabilidad |
|---------|----------------|
| `server/src/lib/mercadopago.ts` | SDK, crear preferencia, verificar webhook, sincronizar pago |
| `server/src/routes/mercadopago-webhook.ts` | `POST /webhooks/mercadopago` — recibe notificaciones de MP |
| `server/src/lib/order-approval.ts` | Lógica de aprobación: crear membresía, payment record, notificaciones |
| `server/src/routes/orders.ts` | CRUD de órdenes, endpoint de checkout y sync con MP |
| `server/src/index.ts` | Registra ruta `/webhooks/mercadopago` |

### 0.4 Archivos clave del frontend

| Archivo | Responsabilidad |
|---------|----------------|
| `src/pages/client/Checkout.tsx` | Selector de plan + método de pago (incluye "Tarjeta de crédito/débito") |
| `src/pages/client/OrderDetail.tsx` | Detalle de orden con botón "Pagar con tarjeta" y "Actualizar estado" |
| `src/types/order.ts` | Tipos TypeScript con campos de MP (`mp_checkout_url`, `mp_payment_status`, etc.) |

### 0.5 Flujo completo paso a paso

```
1. Cliente va a /app/checkout
2. Selecciona un plan (ej: "Inscripción Pago Anual - $500")
3. Elige "Tarjeta de crédito/débito" como método de pago
4. Confirma → frontend hace POST /api/orders con payment_method: 'card'
5. Backend crea la orden Y crea una Preference de Checkout Pro en MP
6. Backend guarda preference_id y checkout_url en la orden
7. Frontend recibe sandbox_checkout_url y redirige al usuario a MercadoPago
8. Usuario paga en MercadoPago (sandbox o producción)
9. MercadoPago envía webhook POST /webhooks/mercadopago con type: 'payment'
10. Backend verifica el webhook, consulta el pago en API de MP
11. Si status === 'approved':
    - Crea membresía con status 'active'
    - Actualiza orden a 'approved'
    - Crea registro en payments
    - Otorga puntos de lealtad
    - Envía email + WhatsApp de confirmación
    - Actualiza wallet pass (Apple/Google)
12. MercadoPago redirige al usuario a /app/orders/{orderId}?checkout=success
13. El OrderDetail muestra el estado actualizado automáticamente
```

### 0.6 Columnas agregadas a la base de datos

**Tabla `orders`:**
```sql
payment_provider VARCHAR(50)       -- 'mercadopago'
payment_intent_id VARCHAR(255)     -- preference_id de MP
mp_checkout_url TEXT               -- URL de checkout para redirect
mp_payment_id VARCHAR(255)         -- ID del pago en MP
mp_payment_status VARCHAR(50)      -- 'approved', 'rejected', etc.
mp_status_detail VARCHAR(100)      -- Detalle del status
provider_metadata JSONB            -- Metadata completa de MP
provider_synced_at TIMESTAMPTZ     -- Última sincronización
```

**Tabla `payments`:**
```sql
order_id UUID                      -- Relación con la orden
provider VARCHAR(50)               -- 'mercadopago'
external_id VARCHAR(255)           -- ID del pago en MP
provider_status VARCHAR(50)        -- Status del pago
provider_payload JSONB             -- Payload completo de MP
mp_payment_id VARCHAR(255)         -- ID del pago (legacy)
```

**Tabla `payment_webhook_events`:**
```sql
CREATE TABLE payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,           -- 'mercadopago'
  event_key VARCHAR(255) NOT NULL,         -- 'payment:12345:payment.created'
  event_type VARCHAR(50),                  -- 'payment', 'merchant_order'
  payload JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, event_key)
);
```

### 0.7 Configuración de Railway

**Servicio backend:**
- Root Directory: `server`
- Start Command: `npm run start`
- Health Check: `/api/health`

**Variables de entorno del backend (relevantes a MP):**
```
MP_ACCESS_TOKEN=APP_USR-4291489784112478-040712-...
MP_PUBLIC_KEY=APP_USR-7c287125-a53c-45e5-...
FRONTEND_URL=https://frontend-production-756b.up.railway.app
BACKEND_URL=https://backend-production-70b6.up.railway.app/api
```

### 0.8 Webhook de MercadoPago

- **URL**: `https://backend-production-70b6.up.railway.app/webhooks/mercadopago`
- **Verificación de firma**: Deshabilitada (webhook_secret vacío). La seguridad se mantiene porque el backend verifica cada pago consultando directamente la API de MP antes de aprobar.
- **Idempotencia**: Tabla `payment_webhook_events` evita procesar el mismo evento dos veces.
- **Ruta registrada SIN prefijo `/api`**: El webhook está en `/webhooks/mercadopago`, no en `/api/webhooks/mercadopago`.

### 0.9 Sandbox vs Producción

**Actualmente en sandbox.** Para usar el sandbox:
- El frontend usa `sandbox_checkout_url` (redirect a `sandbox.mercadopago.com.mx`)
- Pagar con la cuenta de prueba (login en MP, NO ingresar tarjeta nueva — el formulario de tarjeta nueva en sandbox tiene un bug de CORS conocido)

**Para pasar a producción:**
1. En MercadoPago Developer → activar credenciales de producción
2. Actualizar en Railway:
   ```
   MP_ACCESS_TOKEN=<token de producción>
   MP_PUBLIC_KEY=<public key de producción>
   ```
3. Cambiar en el frontend (`Checkout.tsx` y `OrderDetail.tsx`):
   ```js
   // De:
   const checkoutUrl = order.mercadoPagoCheckout.sandbox_checkout_url || order.mercadoPagoCheckout.checkout_url;
   // A:
   const checkoutUrl = order.mercadoPagoCheckout.checkout_url;
   ```
4. Configurar webhook en panel de MP Developer → Notificaciones → URL: `https://backend-production-70b6.up.railway.app/webhooks/mercadopago`
5. Redeploy del frontend y backend en Railway

### 0.10 Errores resueltos durante la implementación

| Error | Causa | Solución |
|-------|-------|----------|
| CORS `card_tokens` en sandbox | Bug conocido de MP entre `secure-fields.mercadopago.com` y `api.mercadopago.com` | Usar login de cuenta de prueba en vez de ingresar tarjeta nueva |
| `validated_by does not exist` | Tabla `payment_proofs` usa `reviewed_by`, no `validated_by` | Corregido en `order-approval.ts` |
| `could not determine data type of parameter $2` | PostgreSQL no infiere tipo de NULL en `$2 IS NOT NULL AND provider = $2` | Agregado cast `$2::text` |
| Webhook retornaba 401 | `webhook_secret` estaba guardado en `system_settings` pero no configurado en MP | Limpiado el secret de la DB; sin secret se acepta el webhook |
| Backend servía HTML en vez de API | Servicio "backend" en Railway no tenía `rootDirectory: "server"` | Configurado via API GraphQL de Railway |
| "Una de las partes es de prueba" | Se usó `checkout_url` (producción) con credenciales de prueba | Revertido a `sandbox_checkout_url` |

---

## 1. Resumen del sistema de pagos

WalletClub funciona como un **marketplace** donde cada estudio tiene su cuenta de MercadoPago. Los pagos se dividen automáticamente: el estudio recibe su parte y WalletClub cobra su comisión.

### 1.1 Modelo de negocio

| Concepto | Detalle |
|----------|---------|
| Procesador | MercadoPago (Checkout API + Marketplace) |
| Modelo | Marketplace 1:1 con Split de pagos |
| Conexión estudio | OAuth: el estudio autoriza su cuenta MP desde Settings |
| Split automático | MP cobra su comisión, WalletClub cobra `application_fee`, estudio recibe el resto |
| Métodos de pago | Tarjeta crédito/débito, OXXO, SPEI, Paycash, saldo MP |
| Suscripciones | Cobros recurrentes automáticos (semanal a anual) |
| MSI | Meses sin intereses disponibles con tarjetas participantes |
| Comisión MP | ~3.49% + IVA por transacción con tarjeta |
| Comisión WalletClub | Configurable por estudio (ej: 5% del monto) |

### 1.2 Tipos de cobro para estudios de Pilates

| Producto | Tipo de cobro | Ejemplo |
|----------|--------------|---------|
| Paquete de clases | Pago único | 10 clases por $1,500 |
| Clase suelta | Pago único | 1 clase por $250 |
| Membresía mensual | Suscripción recurrente | Ilimitado $999/mes |
| Membresía anual | Suscripción recurrente | 12 meses $9,990/año |
| Clase de prueba | Gratis o descuento | Primera clase $99 |
| Mercancía | Pago único | Mat de Pilates $800 |

---

## 2. Requisitos previos

### 2.1 Cuenta de WalletClub (plataforma/marketplace)

1. Crear cuenta en MercadoPago como persona física o moral
2. Ir a "Tus integraciones" en el panel de developer de MP
3. Crear una aplicación con tipo "Marketplace"
4. Obtener `APP_ID`, `CLIENT_SECRET`, `PUBLIC_KEY` y `ACCESS_TOKEN`
5. Configurar URLs de redirect para OAuth: `https://walletclub.mx/auth/mp/callback`
6. Configurar webhooks: `https://api.walletclub.mx/webhooks/mercadopago`
7. Habilitar notificaciones de: `payments`, `chargebacks`, `subscription_preapproval`

### 2.2 Cuenta de cada estudio (vendedor)

Cada estudio necesita su propia cuenta de MercadoPago. La mayoría ya la tiene. El estudio NO necesita hacer nada técnico, solo autorizar la conexión desde WalletClub.

### 2.3 Variables de entorno

```env
MP_APP_ID=tu_app_id
MP_CLIENT_SECRET=tu_client_secret
MP_PUBLIC_KEY=tu_public_key
MP_ACCESS_TOKEN=tu_access_token
MP_WEBHOOK_SECRET=tu_webhook_secret
WALLETCLUB_URL=https://walletclub.mx
API_URL=https://api.walletclub.mx
```

---

## 3. Base de datos

### 3.1 Columnas nuevas en `studios`

```sql
ALTER TABLE studios
  ADD COLUMN mp_access_token TEXT,
  ADD COLUMN mp_refresh_token TEXT,
  ADD COLUMN mp_user_id VARCHAR(50),
  ADD COLUMN mp_connected BOOLEAN DEFAULT false,
  ADD COLUMN mp_connected_at TIMESTAMPTZ,
  ADD COLUMN platform_fee_percent DECIMAL(5,2) DEFAULT 5.00;
```

### 3.2 Tabla: `packages`

```sql
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL, -- 'package' | 'single' | 'subscription' | 'product'
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MXN',
  class_count INT, -- NULL para ilimitado
  duration_days INT, -- vigencia del paquete
  billing_frequency VARCHAR(20), -- 'monthly','yearly' (solo suscripciones)
  mp_plan_id VARCHAR(100), -- ID del plan en MP (solo suscripciones)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Tabla: `user_packages`

```sql
CREATE TABLE user_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  package_id UUID NOT NULL REFERENCES packages(id),
  studio_id UUID NOT NULL REFERENCES studios(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- status: pending | active | expired | cancelled | paused | suspended
  classes_remaining INT, -- NULL para ilimitado
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  mp_payment_id VARCHAR(100),
  mp_subscription_id VARCHAR(100), -- solo suscripciones
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 Tabla: `payments`

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_package_id UUID REFERENCES user_packages(id),
  studio_id UUID NOT NULL REFERENCES studios(id),
  user_id UUID NOT NULL REFERENCES users(id),
  mp_payment_id VARCHAR(100) UNIQUE,
  mp_status VARCHAR(30), -- approved|rejected|in_process|refunded|charged_back
  mp_status_detail VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2), -- comisión WalletClub
  mp_fee DECIMAL(10,2), -- comisión MercadoPago
  net_amount DECIMAL(10,2), -- lo que recibe el estudio
  payment_method VARCHAR(30), -- visa|mastercard|oxxo|spei
  installments INT DEFAULT 1,
  refunded_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);
```

### 3.5 Tabla: `chargebacks`

```sql
CREATE TABLE chargebacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  mp_chargeback_id VARCHAR(100) UNIQUE,
  amount DECIMAL(10,2),
  status VARCHAR(30), -- opened|review_pending|resolved
  coverage_eligible BOOLEAN,
  documentation_deadline TIMESTAMPTZ,
  resolution VARCHAR(30), -- won|lost|pending
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
```

### 3.6 Tabla: `webhook_events` (idempotencia)

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_event_id VARCHAR(200) UNIQUE,
  event_type VARCHAR(50),
  processed BOOLEAN DEFAULT false,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.7 Columna nueva en `users`

```sql
ALTER TABLE users
  ADD COLUMN mp_customer_id VARCHAR(100);
```

---

## 4. Conexión del estudio (OAuth)

El estudio conecta su cuenta de MercadoPago desde **Settings > Pagos**. Es un flujo OAuth estándar.

### 4.1 Flujo paso a paso

1. El estudio da clic en "Conectar MercadoPago" en tu Settings
2. Tu app redirige a MP con la URL de autorización
3. MP muestra pantalla de autorización al estudio
4. El estudio acepta y MP redirige a tu callback con un `code`
5. Tu backend intercambia el `code` por `access_token` y `refresh_token`
6. Guardas los tokens en `studios.mp_access_token`
7. Listo: ya puedes cobrar a nombre del estudio

### 4.2 Código del OAuth

```javascript
// ============================================
// Paso 1: URL de autorización
// GET /api/settings/payments/connect
// ============================================
app.get('/api/settings/payments/connect', (req, res) => {
  const authUrl = 'https://auth.mercadopago.com/authorization'
    + '?client_id=' + MP_APP_ID
    + '&response_type=code'
    + '&platform_id=mp'
    + '&redirect_uri=' + encodeURIComponent(CALLBACK_URL)
    + '&state=' + req.studioId; // para saber qué estudio se conecta
  res.redirect(authUrl);
});

// ============================================
// Paso 2: Callback - intercambiar code por tokens
// GET /auth/mp/callback?code=XXX&state=studioId
// ============================================
app.get('/auth/mp/callback', async (req, res) => {
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: MP_APP_ID,
      client_secret: MP_CLIENT_SECRET,
      code: req.query.code,
      grant_type: 'authorization_code',
      redirect_uri: CALLBACK_URL
    })
  });
  const { access_token, refresh_token, user_id } = await response.json();

  // Paso 3: Guardar en DB
  await db.query(`UPDATE studios SET
    mp_access_token = $1, mp_refresh_token = $2,
    mp_user_id = $3, mp_connected = true,
    mp_connected_at = NOW() WHERE id = $4`,
    [access_token, refresh_token, user_id, req.query.state]);

  res.redirect('/settings/payments?connected=true');
});
```

### 4.3 Renovar tokens (cron cada 5 meses)

```javascript
// El access_token de OAuth expira (~6 meses)
// Renovar ANTES de que expire
async function renewOAuthTokens() {
  const studios = await db.query(
    `SELECT id, mp_refresh_token FROM studios
     WHERE mp_connected = true
     AND mp_connected_at < NOW() - INTERVAL '5 months'`);

  for (const studio of studios.rows) {
    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: MP_APP_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: studio.mp_refresh_token
      })
    });
    const { access_token, refresh_token } = await res.json();
    await db.query(`UPDATE studios SET
      mp_access_token=$1, mp_refresh_token=$2, mp_connected_at=NOW()
      WHERE id=$3`, [access_token, refresh_token, studio.id]);
  }
}
```

---

## 5. Pago único: paquetes de clases

### 5.1 Frontend: Card Payment Brick

MercadoPago te da un componente "Brick" que es un form de tarjeta seguro. Los datos de la tarjeta NUNCA pasan por tu servidor.

```jsx
// En tu frontend (React)
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

// Usar la PUBLIC_KEY del estudio (obtenida via OAuth)
initMercadoPago(studioPublicKey);

function CheckoutPage({ selectedPackage, user }) {
  return (
    <CardPayment
      initialization={{
        amount: selectedPackage.price,
        payer: { email: user.email }
      }}
      onSubmit={async (formData) => {
        // formData contiene: token, payment_method_id, installments, issuer_id
        const res = await fetch('/api/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            package_id: selectedPackage.id,
            ...formData
          })
        });
        const result = await res.json();

        if (result.status === 'approved') {
          // Mostrar éxito (pero el paquete se activa por webhook)
          showSuccess();
        } else if (result.status === 'in_process') {
          showPending(); // "Tu pago está en revisión"
        } else {
          showError(result.status_detail); // Mostrar mensaje de rechazo
        }
      }}
      onError={(error) => {
        console.error('Brick error:', error);
      }}
    />
  );
}
```

### 5.2 Backend: crear el pago con split de comisión

```javascript
// POST /api/payments/create
app.post('/api/payments/create', async (req, res) => {
  const pkg = await getPackage(req.body.package_id);
  const studio = await getStudio(pkg.studio_id);
  const user = req.user;

  // Calcular comisión de WalletClub (en centavos para MP)
  const feeAmount = Math.round(pkg.price * studio.platform_fee_percent / 100 * 100) / 100;

  // Crear user_package en estado "pending"
  const userPkg = await db.query(`INSERT INTO user_packages
    (user_id, package_id, studio_id, status, classes_remaining)
    VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
    [user.id, pkg.id, studio.id, pkg.class_count]);

  // Crear pago en MercadoPago usando el token del estudio
  const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + studio.mp_access_token,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID() // evitar duplicados
    },
    body: JSON.stringify({
      transaction_amount: pkg.price,
      token: req.body.token,
      description: `${pkg.name} - ${studio.name}`,
      installments: req.body.installments || 1,
      payment_method_id: req.body.payment_method_id,
      issuer_id: req.body.issuer_id,
      payer: {
        email: req.body.payer.email,
        identification: req.body.payer.identification
      },
      // === SPLIT DE PAGOS (MARKETPLACE) ===
      application_fee: feeAmount, // Comisión de WalletClub
      // ====================================
      external_reference: userPkg.rows[0].id, // vincular con tu DB
      notification_url: 'https://api.walletclub.mx/webhooks/mercadopago',
      statement_descriptor: studio.name.substring(0, 22) // nombre en estado de cuenta
    })
  });
  const mpData = await mpResponse.json();

  // Guardar pago en tu DB (NO activar todavía)
  await db.query(`INSERT INTO payments
    (user_package_id, studio_id, user_id, mp_payment_id,
     mp_status, mp_status_detail, amount, platform_fee, payment_method, installments)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [userPkg.rows[0].id, studio.id, user.id, mpData.id,
     mpData.status, mpData.status_detail, pkg.price, feeAmount,
     mpData.payment_method_id, mpData.installments]);

  // Retornar status al frontend
  res.json({
    status: mpData.status,
    status_detail: mpData.status_detail,
    payment_id: mpData.id
  });
});
```

> **⛔ REGLA DE ORO: NUNCA actives el paquete basándote en la respuesta de la API. Solo activa cuando el webhook confirme `status = 'approved'`.**

---

## 6. Webhooks: la fuente de verdad

Los webhooks de MercadoPago son tu fuente de verdad para saber si un pago fue aprobado, rechazado, reembolsado o tiene contracargo.

### 6.1 Endpoint receptor

```javascript
// POST /webhooks/mercadopago
app.post('/webhooks/mercadopago', async (req, res) => {
  // 1. Responder 200 INMEDIATAMENTE (MP espera respuesta rápida)
  res.status(200).end();

  // 2. Verificar idempotencia
  const eventId = req.body.data?.id || req.body.id;
  try {
    await db.query(
      'INSERT INTO webhook_events (mp_event_id, event_type, payload) VALUES ($1,$2,$3)',
      [eventId, req.body.type, JSON.stringify(req.body)]);
  } catch (e) {
    if (e.code === '23505') return; // ya procesado (unique violation)
    throw e;
  }

  // 3. Procesar según tipo
  try {
    switch (req.body.type) {
      case 'payment':
        await handlePaymentWebhook(req.body.data.id);
        break;
      case 'chargebacks':
        await handleChargebackWebhook(req.body.data.id);
        break;
      case 'subscription_preapproval':
        await handleSubscriptionWebhook(req.body.data.id);
        break;
    }
    // Marcar como procesado
    await db.query(
      'UPDATE webhook_events SET processed=true WHERE mp_event_id=$1', [eventId]);
  } catch (error) {
    console.error('Webhook processing error:', error);
    // No lanzar error: ya respondimos 200
    // MP reintentará si no procesamos correctamente
  }
});
```

### 6.2 Procesar webhook de pago

```javascript
async function handlePaymentWebhook(paymentId) {
  // Obtener info completa del pago desde MP
  const mpRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
  );
  const payment = await mpRes.json();

  // Actualizar estado en tu DB
  await db.query(`UPDATE payments SET
    mp_status = $1,
    mp_status_detail = $2,
    mp_fee = $3,
    net_amount = $4,
    approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END
    WHERE mp_payment_id = $5`,
    [payment.status, payment.status_detail,
     payment.fee_details?.[0]?.amount || 0,
     payment.transaction_details?.net_received_amount || 0,
     paymentId]);

  // === PAGO APROBADO: activar paquete ===
  if (payment.status === 'approved') {
    const ref = payment.external_reference; // = user_packages.id
    await db.query(`UPDATE user_packages SET
      status = 'active',
      started_at = NOW(),
      mp_payment_id = $2,
      expires_at = NOW() + (
        SELECT duration_days * INTERVAL '1 day'
        FROM packages WHERE id = package_id
      )
      WHERE id = $1 AND status = 'pending'`, [ref, paymentId]);

    // Enviar email/push de confirmación
    const userPkg = await getUserPackage(ref);
    await sendPaymentConfirmation(userPkg);
  }

  // === PAGO RECHAZADO ===
  if (payment.status === 'rejected') {
    await notifyPaymentRejected(payment);
  }

  // === PAGO REEMBOLSADO ===
  if (payment.status === 'refunded') {
    const ref = payment.external_reference;
    await db.query(`UPDATE user_packages SET status = 'cancelled'
      WHERE id = $1`, [ref]);
    await db.query(`UPDATE payments SET
      refunded_amount = $1, refunded_at = NOW()
      WHERE mp_payment_id = $2`, [payment.transaction_amount, paymentId]);
  }
}
```

---

## 7. Manejo de pagos rechazados

Aproximadamente 15-20% de los pagos con tarjeta son rechazados en México. Tu app debe mostrar mensajes claros y ofrecer alternativas.

### 7.1 Códigos de rechazo y mensajes para el usuario

| Código MP | Mensaje para el usuario | Acción |
|-----------|------------------------|--------|
| `cc_rejected_insufficient_amount` | Fondos insuficientes. Verifica tu saldo o usa otra tarjeta. | Ofrecer otra tarjeta o OXXO |
| `cc_rejected_bad_filled_security_code` | Código de seguridad incorrecto. Revisa los 3 dígitos. | Reintentar |
| `cc_rejected_bad_filled_date` | Fecha de vencimiento incorrecta. | Reintentar |
| `cc_rejected_bad_filled_other` | Revisa los datos de tu tarjeta e intenta de nuevo. | Reintentar |
| `cc_rejected_card_disabled` | Tu tarjeta está deshabilitada. Contacta a tu banco. | Otra tarjeta |
| `cc_rejected_call_for_authorize` | Debes autorizar el pago llamando a tu banco. | Llamar al banco |
| `cc_rejected_duplicated_payment` | Ya se procesó un pago igual. Revisa tu historial. | No reintentar |
| `cc_rejected_high_risk` | Pago rechazado por seguridad. Intenta con otro método. | OXXO o SPEI |
| `cc_rejected_other_reason` | No pudimos procesar el pago. Intenta con otro método. | OXXO o SPEI |

### 7.2 Código del frontend para manejar rechazos

```javascript
const REJECTION_MESSAGES = {
  cc_rejected_insufficient_amount: {
    message: 'Fondos insuficientes. Verifica tu saldo o usa otra tarjeta.',
    action: 'alternate', // mostrar OXXO/SPEI
  },
  cc_rejected_bad_filled_security_code: {
    message: 'Código de seguridad incorrecto. Revisa los 3 dígitos de tu tarjeta.',
    action: 'retry',
  },
  cc_rejected_bad_filled_date: {
    message: 'Fecha de vencimiento incorrecta.',
    action: 'retry',
  },
  cc_rejected_card_disabled: {
    message: 'Tu tarjeta está deshabilitada. Contacta a tu banco.',
    action: 'alternate',
  },
  cc_rejected_call_for_authorize: {
    message: 'Tu banco necesita que autorices este pago. Llama al número de tu tarjeta.',
    action: 'call_bank',
  },
  cc_rejected_duplicated_payment: {
    message: 'Ya se procesó un pago igual. Revisa tu historial de compras.',
    action: 'none',
  },
  cc_rejected_high_risk: {
    message: 'El pago fue rechazado por seguridad. Intenta con OXXO o transferencia.',
    action: 'alternate',
  },
};

function getRejectMessage(statusDetail) {
  return REJECTION_MESSAGES[statusDetail] || {
    message: 'No pudimos procesar el pago. Intenta con otro método de pago.',
    action: 'alternate',
  };
}
```

> **⛔ NUNCA reintentar automáticamente con la misma tarjeta. MercadoPago bloquea IPs que hacen reintentos excesivos.**

---

## 8. Reembolsos

### 8.1 Reembolso total

```javascript
// POST /api/payments/:paymentId/refund
app.post('/api/payments/:paymentId/refund', async (req, res) => {
  const payment = await getPaymentByMpId(req.params.paymentId);
  const studio = await getStudio(payment.studio_id);

  // Crear reembolso en MercadoPago
  const mpRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${req.params.paymentId}/refunds`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studio.mp_access_token}` }
    }
  );

  if (mpRes.ok) {
    // Actualizar tu DB
    await db.query(`UPDATE payments SET
      mp_status = 'refunded',
      refunded_amount = amount,
      refunded_at = NOW()
      WHERE mp_payment_id = $1`, [req.params.paymentId]);

    // Desactivar paquete del usuario
    await db.query(`UPDATE user_packages SET status = 'cancelled'
      WHERE mp_payment_id = $1`, [req.params.paymentId]);

    res.json({ success: true });
  } else {
    const error = await mpRes.json();
    res.status(400).json({ error: error.message });
  }
});
```

### 8.2 Reembolso parcial

Ejemplo: el usuario compró 10 clases por $1,500, usó 7 y quiere devolución de las 3 restantes ($450).

```javascript
// POST /api/payments/:paymentId/partial-refund
app.post('/api/payments/:paymentId/partial-refund', async (req, res) => {
  const { classesToRefund } = req.body;
  const payment = await getPaymentByMpId(req.params.paymentId);
  const userPkg = await getUserPackage(payment.user_package_id);
  const pkg = await getPackage(userPkg.package_id);

  // Calcular monto a reembolsar
  const pricePerClass = pkg.price / pkg.class_count;
  const refundAmount = Math.round(pricePerClass * classesToRefund * 100) / 100;

  const studio = await getStudio(payment.studio_id);

  const mpRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${req.params.paymentId}/refunds`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${studio.mp_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount: refundAmount })
    }
  );

  if (mpRes.ok) {
    await db.query(`UPDATE payments SET
      refunded_amount = refunded_amount + $1,
      refunded_at = NOW()
      WHERE mp_payment_id = $2`, [refundAmount, req.params.paymentId]);

    // Reducir clases restantes a 0 (ya se reembolsaron)
    await db.query(`UPDATE user_packages SET
      classes_remaining = classes_remaining - $1
      WHERE id = $2`, [classesToRefund, userPkg.id]);

    res.json({ success: true, refunded: refundAmount });
  }
});
```

> **⚠️ En modelo marketplace, la comisión de WalletClub también se devuelve proporcionalmente. Si reembolsas el 30%, pierdes el 30% de tu comisión.**

---

## 9. Contracargos (chargebacks)

> **⛔ Los contracargos son el mayor riesgo financiero de cobrar con tarjeta. Si pierdes, el estudio pierde el dinero Y ya prestó el servicio.**

### 9.1 Qué es un contracargo

El usuario va con su banco y dice "yo no hice ese cobro". El banco retiene el dinero de la cuenta del estudio inmediatamente y abre una investigación que puede tardar hasta **6 meses**.

### 9.2 Flujo de manejo

1. MP te envía webhook tipo `chargebacks`
2. Obtener info: `GET /v1/chargebacks/{id}`
3. Verificar si `coverage_eligible = true`
4. Si `documentation_required = true`, reunir evidencia
5. Enviar documentación: `POST /v1/chargebacks/{id}/documentation`
6. Esperar resolución vía webhook (puede tardar meses)

### 9.3 Evidencia que debes guardar SIEMPRE

Para cada venta y cada clase tomada, guarda:
- Registro de check-in del usuario (fecha, hora, IP, device)
- Email de confirmación de compra del paquete
- Historial de clases tomadas con el paquete
- IP y dispositivo desde donde se hizo el pago
- Términos y condiciones aceptados por el usuario
- Política de cancelación/reembolso del estudio
- Screenshots del perfil del usuario en tu sistema

### 9.4 Código de manejo de contracargos

```javascript
async function handleChargebackWebhook(chargebackId) {
  // 1. Obtener info completa del contracargo
  const cbRes = await fetch(
    `https://api.mercadopago.com/v1/chargebacks/${chargebackId}`,
    { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
  );
  const cb = await cbRes.json();

  // 2. Guardar en tu DB
  await db.query(`INSERT INTO chargebacks
    (payment_id, mp_chargeback_id, amount, status,
     coverage_eligible, documentation_deadline)
    VALUES (
      (SELECT id FROM payments WHERE mp_payment_id = $1),
      $2, $3, 'opened', $4, $5)`,
    [cb.payments[0].id, chargebackId, cb.amount,
     cb.coverage_eligible, cb.date_documentation_deadline]);

  // 3. Suspender paquete del usuario inmediatamente
  await db.query(`UPDATE user_packages SET status = 'suspended'
    WHERE mp_payment_id = $1`, [cb.payments[0].id]);

  // 4. Notificar al estudio
  const studio = await getStudioByPayment(cb.payments[0].id);
  await sendChargebackNotification(studio, cb);

  // 5. Si es elegible para cobertura y requiere docs
  if (cb.coverage_eligible && cb.documentation_required) {
    // Reunir evidencia automáticamente
    const evidence = await gatherEvidence(cb.payments[0].id);
    // Notificar al admin que debe subir documentación antes del deadline
    await notifyAdminUploadDocs(studio, cb, evidence);
  }
}

// Subir documentación de defensa
async function uploadChargebackDocs(chargebackId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files[]', file);
  }

  await fetch(
    `https://api.mercadopago.com/v1/chargebacks/${chargebackId}/documentation`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
      body: formData
    }
  );
}
```

### 9.5 Prevención de contracargos

1. **3D Secure**: MP lo activa automáticamente en pagos de riesgo
2. **Statement descriptor**: que el nombre del estudio aparezca claro en el estado de cuenta (`statement_descriptor` en el payload del pago)
3. **Email de confirmación**: enviar inmediatamente con detalle del paquete comprado
4. **Política de reembolso**: visible y aceptada antes de pagar
5. **Guardar check-ins**: evidencia de cada clase tomada con fecha, hora, IP y device
6. **Device ID**: incluir `device_id` en el pago para mejorar la tasa de aprobación y tener evidencia

---

## 10. Suscripciones recurrentes

### 10.1 Crear plan de suscripción

Cuando el admin del estudio crea un paquete tipo "subscription", tu backend crea el plan en MP.

```javascript
// Se ejecuta al crear un paquete tipo "subscription" en tu admin
async function createMPPlan(studio, pkg) {
  const res = await fetch('https://api.mercadopago.com/preapproval_plan', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studio.mp_access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reason: `${pkg.name} - ${studio.name}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: pkg.billing_frequency === 'yearly' ? 'years' : 'months',
        transaction_amount: pkg.price,
        currency_id: 'MXN'
      },
      back_url: `${WALLETCLUB_URL}/pagos/resultado`
    })
  });
  const plan = await res.json();

  // Guardar el plan_id en tu tabla packages
  await db.query(`UPDATE packages SET mp_plan_id = $1 WHERE id = $2`,
    [plan.id, pkg.id]);

  return plan;
}
```

### 10.2 Suscribir usuario al plan

```javascript
// Cuando el usuario compra una membresía
async function subscribeUser(studio, user, pkg, cardToken) {
  // 1. Crear user_package
  const userPkg = await db.query(`INSERT INTO user_packages
    (user_id, package_id, studio_id, status, classes_remaining)
    VALUES ($1,$2,$3,'pending',$4) RETURNING id`,
    [user.id, pkg.id, studio.id, pkg.class_count]);

  // 2. Crear suscripción en MP
  const res = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studio.mp_access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      preapproval_plan_id: pkg.mp_plan_id,
      payer_email: user.email,
      card_token_id: cardToken,
      external_reference: userPkg.rows[0].id
    })
  });
  const sub = await res.json();

  // 3. Guardar subscription ID
  await db.query(`UPDATE user_packages SET
    mp_subscription_id = $1 WHERE id = $2`,
    [sub.id, userPkg.rows[0].id]);

  return sub;
}
```

### 10.3 Estados de suscripción

| Estado MP | Significado | Acción en tu sistema |
|-----------|-------------|---------------------|
| `authorized` | Activa, cobros al día | Paquete activo, acceso completo |
| `paused` | Pausada por fallo de pago | Suspender acceso, notificar usuario |
| `cancelled` | Cancelada por usuario o admin | Desactivar paquete |
| `pending` | Esperando primer pago | Paquete pendiente, sin acceso |

### 10.4 Webhook de suscripción

```javascript
async function handleSubscriptionWebhook(subscriptionId) {
  // Obtener info actualizada de la suscripción
  const subRes = await fetch(
    `https://api.mercadopago.com/preapproval/${subscriptionId}`,
    { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
  );
  const sub = await subRes.json();

  const ref = sub.external_reference; // = user_packages.id

  switch (sub.status) {
    case 'authorized':
      // Suscripción activa: activar o renovar paquete
      await db.query(`UPDATE user_packages SET
        status = 'active',
        started_at = COALESCE(started_at, NOW()),
        expires_at = NOW() + INTERVAL '1 month'
        WHERE id = $1`, [ref]);
      break;

    case 'paused':
      // Fallo de pago: suspender acceso
      await db.query(`UPDATE user_packages SET status = 'paused'
        WHERE id = $1`, [ref]);
      // Notificar al usuario que actualice su tarjeta
      await notifyPaymentFailed(ref);
      break;

    case 'cancelled':
      // Cancelada: desactivar
      await db.query(`UPDATE user_packages SET status = 'cancelled'
        WHERE id = $1`, [ref]);
      await notifySubscriptionCancelled(ref);
      break;
  }
}
```

### 10.5 Cancelar suscripción (por el usuario o admin)

```javascript
// POST /api/subscriptions/cancel
app.post('/api/subscriptions/cancel', async (req, res) => {
  const userPkg = await getUserPackage(req.body.user_package_id);
  const studio = await getStudio(userPkg.studio_id);

  // Cancelar en MercadoPago
  await fetch(
    `https://api.mercadopago.com/preapproval/${userPkg.mp_subscription_id}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${studio.mp_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'cancelled' })
    }
  );

  // Actualizar en tu DB
  await db.query(`UPDATE user_packages SET status = 'cancelled'
    WHERE id = $1`, [userPkg.id]);

  res.json({ success: true });
});
```

---

## 11. Consumir clases del paquete

Cuando el usuario reserva una clase, tu sistema verifica que tiene clases disponibles y decrementa el contador.

```javascript
async function consumeClass(userId, studioId, scheduleId) {
  // 1. Buscar paquete activo con clases restantes
  //    FIFO: usar primero el que vence antes
  const result = await db.query(`
    SELECT * FROM user_packages
    WHERE user_id = $1
    AND studio_id = $2
    AND status = 'active'
    AND (classes_remaining > 0 OR classes_remaining IS NULL)
    AND (expires_at > NOW() OR expires_at IS NULL)
    ORDER BY expires_at ASC NULLS LAST
    LIMIT 1`, [userId, studioId]);

  if (result.rows.length === 0) {
    throw new Error('No tienes un paquete activo con clases disponibles');
  }

  const pkg = result.rows[0];

  // 2. Decrementar clases (si no es ilimitado)
  if (pkg.classes_remaining !== null) {
    await db.query(`UPDATE user_packages
      SET classes_remaining = classes_remaining - 1
      WHERE id = $1`, [pkg.id]);

    // 3. Si era la última clase, marcar como expirado
    if (pkg.classes_remaining <= 1) {
      await db.query(`UPDATE user_packages
        SET status = 'expired' WHERE id = $1`, [pkg.id]);
    }
  }

  // 4. Crear la reserva vinculada al paquete
  await db.query(`INSERT INTO bookings
    (schedule_id, user_id, user_package_id, status)
    VALUES ($1, $2, $3, 'confirmed')`,
    [scheduleId, userId, pkg.id]);

  return {
    package_name: pkg.name,
    classes_left: pkg.classes_remaining !== null ? pkg.classes_remaining - 1 : null,
    expires_at: pkg.expires_at
  };
}
```

### 11.1 Verificar paquete antes de reservar

```javascript
async function canUserBook(userId, studioId) {
  const result = await db.query(`
    SELECT up.*, p.name as package_name
    FROM user_packages up
    JOIN packages p ON p.id = up.package_id
    WHERE up.user_id = $1
    AND up.studio_id = $2
    AND up.status = 'active'
    AND (up.classes_remaining > 0 OR up.classes_remaining IS NULL)
    AND (up.expires_at > NOW() OR up.expires_at IS NULL)
    LIMIT 1`, [userId, studioId]);

  if (result.rows.length === 0) {
    return {
      canBook: false,
      reason: 'No tienes un paquete activo. Compra uno para reservar.'
    };
  }

  return {
    canBook: true,
    package: result.rows[0],
    classesLeft: result.rows[0].classes_remaining,
    expiresAt: result.rows[0].expires_at
  };
}
```

---

## 12. Cron jobs

| Job | Frecuencia | Qué hace |
|-----|-----------|----------|
| Vencimiento de paquetes | Diario 00:00 | `UPDATE user_packages SET status='expired' WHERE expires_at < NOW() AND status='active'` |
| Notificar próximos a vencer | Diario 10:00 | Enviar email/push a usuarios con paquetes que vencen en 7 días |
| Renovar OAuth tokens | Cada 5 meses | `POST /oauth/token` con `refresh_token` para cada estudio |
| Conciliación | Diario 02:00 | Comparar pagos en MP vs `user_packages` activos, detectar discrepancias |
| Limpiar webhook_events | Semanal | `DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL '90 days'` |

### 12.1 Código de vencimiento

```javascript
// Cron: cada día a las 00:00
async function expirePackages() {
  // Expirar paquetes vencidos
  const expired = await db.query(`
    UPDATE user_packages SET status = 'expired'
    WHERE expires_at < NOW()
    AND status = 'active'
    RETURNING id, user_id, package_id`);

  console.log(`Expirados: ${expired.rowCount} paquetes`);

  // Notificar a cada usuario
  for (const pkg of expired.rows) {
    await notifyPackageExpired(pkg.user_id, pkg.package_id);
  }
}

// Cron: cada día a las 10:00
async function notifyExpiringPackages() {
  const expiring = await db.query(`
    SELECT up.*, u.email, u.name, p.name as pkg_name
    FROM user_packages up
    JOIN users u ON u.id = up.user_id
    JOIN packages p ON p.id = up.package_id
    WHERE up.status = 'active'
    AND up.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'`);

  for (const pkg of expiring.rows) {
    await sendEmail(pkg.email, 'Tu paquete está por vencer', {
      name: pkg.name,
      package: pkg.pkg_name,
      expires: pkg.expires_at,
      classesLeft: pkg.classes_remaining
    });
  }
}
```

### 12.2 Conciliación diaria

```javascript
// Cron: cada día a las 02:00
async function reconcilePayments() {
  // Buscar paquetes activos sin pago aprobado
  const orphans = await db.query(`
    SELECT up.id, up.user_id
    FROM user_packages up
    LEFT JOIN payments p ON p.user_package_id = up.id AND p.mp_status = 'approved'
    WHERE up.status = 'active'
    AND p.id IS NULL
    AND up.created_at < NOW() - INTERVAL '1 hour'`);

  if (orphans.rowCount > 0) {
    console.warn(`⚠️ ${orphans.rowCount} paquetes activos sin pago aprobado`);
    // Investigar cada uno: consultar estado en MP
    for (const orphan of orphans.rows) {
      // Desactivar si no hay pago válido
      await db.query(`UPDATE user_packages SET status = 'pending'
        WHERE id = $1`, [orphan.id]);
    }
  }

  // Buscar pagos aprobados sin paquete activo
  const missedActivations = await db.query(`
    SELECT p.mp_payment_id, p.user_package_id
    FROM payments p
    JOIN user_packages up ON up.id = p.user_package_id
    WHERE p.mp_status = 'approved'
    AND up.status = 'pending'
    AND p.approved_at < NOW() - INTERVAL '10 minutes'`);

  if (missedActivations.rowCount > 0) {
    console.warn(`⚠️ ${missedActivations.rowCount} pagos aprobados con paquete pendiente`);
    for (const missed of missedActivations.rows) {
      // Activar el paquete que no se activó por fallo de webhook
      await handlePaymentWebhook(missed.mp_payment_id);
    }
  }
}
```

---

## 13. Pantallas de tu sistema

### 13.1 Settings > Pagos (nueva)

- Botón "Conectar MercadoPago" con OAuth flow
- Estado: Conectado / Sin conectar
- Email de la cuenta MP conectada
- Configurar comisión de WalletClub (%)
- Botón "Desconectar"

### 13.2 Admin > Paquetes (nueva)

- CRUD de paquetes: nombre, precio, tipo, cantidad de clases, vigencia
- Toggle activar/desactivar paquetes
- Para suscripciones: crear el plan en MP automáticamente al guardar
- Vista previa de cómo se ve en la app del usuario

### 13.3 App usuario > Comprar paquete

- Lista de paquetes disponibles del estudio
- Card Payment Brick embebido (form de tarjeta de MP)
- Opciones alternativas: OXXO, SPEI
- MSI si la tarjeta lo permite
- Pantalla de resultado: aprobado, pendiente, rechazado con mensajes claros

### 13.4 App usuario > Mis paquetes

- Paquetes activos con clases restantes y fecha de vencimiento
- Barra de progreso visual (7/10 clases usadas)
- Historial de pagos con status
- Estado de suscripciones (activa, pausada)
- Botón cancelar suscripción

### 13.5 Admin > Pagos/Finanzas

- Lista de pagos recibidos con status
- Contracargos pendientes con deadline de documentación
- Revenue por período (semanal, mensual)
- Desglose: monto bruto, comisión MP, comisión WalletClub, neto
- Exportar a CSV/Excel

---

## 14. Endpoints de tu API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/settings/payments` | Estado de conexión MP del estudio |
| GET | `/auth/mp/connect` | Iniciar OAuth con MercadoPago |
| GET | `/auth/mp/callback` | Callback de OAuth |
| DELETE | `/api/settings/payments/disconnect` | Desconectar MP |
| GET | `/api/packages` | Listar paquetes del estudio |
| POST | `/api/packages` | Crear paquete |
| PUT | `/api/packages/:id` | Editar paquete |
| DELETE | `/api/packages/:id` | Eliminar paquete |
| POST | `/api/payments/create` | Crear pago (split marketplace) |
| POST | `/api/payments/:id/refund` | Reembolso total |
| POST | `/api/payments/:id/partial-refund` | Reembolso parcial |
| GET | `/api/user/packages` | Paquetes activos del usuario |
| GET | `/api/user/payments` | Historial de pagos del usuario |
| POST | `/api/subscriptions/cancel` | Cancelar suscripción |
| POST | `/webhooks/mercadopago` | Receptor de webhooks MP |
| GET | `/api/admin/payments` | Historial de pagos (admin) |
| GET | `/api/admin/chargebacks` | Contracargos (admin) |
| GET | `/api/admin/revenue` | Revenue por período |

---

## 15. Orden de implementación

| Fase | Qué | Tiempo |
|------|-----|--------|
| 1 | Migraciones SQL + crear app en MP Developer + OAuth flow | 1 día |
| 2 | CRUD de paquetes (admin) + pantalla Settings > Pagos | 1 día |
| 3 | Card Payment Brick (frontend) + crear pago con split (backend) | 2 días |
| 4 | Webhooks: payment approved/rejected + activar paquete | 1 día |
| 5 | Rechazos: mensajes claros + OXXO/SPEI como fallback | 0.5 días |
| 6 | Reembolsos total y parcial | 0.5 días |
| 7 | Suscripciones: crear plan + suscribir + webhook | 1-2 días |
| 8 | Contracargos: webhook + panel admin + documentación | 1 día |
| 9 | Consumir clases del paquete + vencimiento | 0.5 días |
| 10 | Conciliación + cron jobs + testing | 1 día |

**Total estimado: 9-12 días de desarrollo.**

---

## 16. Checklist final

| # | Item | OK |
|---|------|-----|
| 1 | App creada en MP Developer como Marketplace | [ ] |
| 2 | Migraciones SQL ejecutadas (6 tablas/columnas) | [ ] |
| 3 | OAuth flow funcional (conectar estudio) | [ ] |
| 4 | Cron de renovación de OAuth tokens (cada 5 meses) | [ ] |
| 5 | CRUD de paquetes en admin | [ ] |
| 6 | Card Payment Brick renderiza en frontend | [ ] |
| 7 | Pago con split: MP cobra, WC cobra, estudio recibe | [ ] |
| 8 | Webhook payment: approved activa paquete | [ ] |
| 9 | Webhook payment: rejected notifica usuario | [ ] |
| 10 | Pago pendiente (in_process) NO activa paquete | [ ] |
| 11 | Mensajes claros por cada código de rechazo | [ ] |
| 12 | OXXO y SPEI como fallback | [ ] |
| 13 | Reembolso total funciona | [ ] |
| 14 | Reembolso parcial funciona | [ ] |
| 15 | Suscripción: crear plan + suscribir usuario | [ ] |
| 16 | Webhook suscripción: authorized/paused/cancelled | [ ] |
| 17 | Webhook contracargo: notifica estudio + suspende paquete | [ ] |
| 18 | Evidencia guardada por cada clase (check-in, IP, device) | [ ] |
| 19 | Consumir clases decrementa contador (FIFO) | [ ] |
| 20 | Paquetes vencidos se desactivan automáticamente | [ ] |
| 21 | Idempotencia en webhooks (webhook_events) | [ ] |
| 22 | Conciliación diaria MP vs DB | [ ] |
| 23 | Panel admin: pagos + contracargos + revenue | [ ] |
| 24 | Testing en sandbox MP | [ ] |

---

## 17. URLs de referencia

| Recurso | URL |
|---------|-----|
| MP Developer Portal | https://www.mercadopago.com.mx/developers |
| Checkout API (nueva, vía Orders) | https://www.mercadopago.com.mx/developers/es/docs/checkout-api-orders/overview |
| Card Payment Brick | https://www.mercadopago.com.mx/developers/es/docs/checkout-bricks/card-payment-brick |
| Marketplace / Split | https://www.mercadopago.com.mx/developers/es/docs/split-payments/landing |
| OAuth | https://www.mercadopago.com.mx/developers/es/docs/security/oauth/creation |
| Suscripciones | https://www.mercadopago.com.mx/developers/es/docs/subscriptions/overview |
| Contracargos | https://www.mercadopago.com.mx/developers/es/docs/checkout-api/chargebacks |
| Webhooks | https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks |
| Códigos de rechazo | https://www.mercadopago.com.mx/developers/es/docs/checkout-api/response-handling/collection-results |
| SDK React | https://www.npmjs.com/package/@mercadopago/sdk-react |
| Tarifas MP México | https://www.mercadopago.com.mx/costs |
