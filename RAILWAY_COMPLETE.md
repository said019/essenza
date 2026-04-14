# 🚂 Despliegue Completo en Railway

## Todo en Railway: Frontend + Backend + PostgreSQL

### 🎯 Ventajas de usar solo Railway:
- ✅ Todo en un solo lugar
- ✅ $5 de crédito gratis cada mes
- ✅ PostgreSQL incluido
- ✅ SSL automático
- ✅ Deploy con Git push
- ✅ Monitoreo centralizado

---

## 📋 Paso a Paso (15 minutos)

### 1️⃣ Preparar el Código

```bash
# Asegúrate de estar en la raíz del proyecto
cd /Users/saidromero/Desktop/Catarsis/Catarsis

# Verificar que todo esté listo
git status
git add .
git commit -m "Ready for Railway deployment"

# Si no tienes repositorio remoto, créalo en GitHub y luego:
git remote add origin https://github.com/tu-usuario/catarsis.git
git push -u origin main
```

---

### 2️⃣ Crear Cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Click en **"Login"** → **"Login with GitHub"**
3. Autoriza Railway para acceder a tus repos

---

### 3️⃣ Crear Nuevo Proyecto

1. Click en **"New Project"**
2. Verás opciones de plantillas

---

### 4️⃣ Crear PostgreSQL (Base de Datos)

1. Selecciona **"Provision PostgreSQL"**
2. Railway creará automáticamente la base de datos
3. **MUY IMPORTANTE:** Click en el servicio PostgreSQL
4. Ve a la pestaña **"Variables"**
5. **Copia** el valor de `DATABASE_URL` (lo usarás en el paso 6)
   - Debería verse así: `postgresql://postgres:xxx@xxx.railway.app:xxxx/railway`

---

### 5️⃣ Desplegar el BACKEND

1. En el mismo proyecto, click en **"+ New"** (arriba derecha)
2. Selecciona **"GitHub Repo"**
3. Busca y selecciona tu repo **"Catarsis"**
4. Railway detectará que es un monorepo

#### Configurar el Backend:

**a) Root Directory:**
- Click en el servicio → **Settings**
- Busca **"Root Directory"**
- Escribe: `/server`
- Click **"Save"**

**b) Build Command (opcional, auto-detecta):**
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

**c) Variables de Entorno:**
- Click en la pestaña **"Variables"**
- Click **"+ New Variable"** y agrega estas 4:

```bash
NODE_ENV=production

DATABASE_URL=postgresql://postgres:xxx@xxx.railway.app:xxxx/railway
# ☝️ Pega el valor que copiaste del paso 4

JWT_SECRET=corre_este_comando_en_terminal_para_generar_uno
# Genera uno corriendo: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

FRONTEND_URL=${{Railway.STATIC_URL}}
# ☝️ Escribe exactamente esto, Railway lo reemplazará automáticamente
```

**d) Obtener la URL del Backend:**
- Ve a **Settings** → **Networking**
- Click en **"Generate Domain"**
- Copia la URL (ej: `catarsis-backend-production.up.railway.app`)
- **Guárdala** para el paso 6

---

### 6️⃣ Desplegar el FRONTEND

1. En el mismo proyecto, click en **"+ New"** → **"GitHub Repo"**
2. Selecciona el mismo repo **"Catarsis"** (sí, otra vez)
3. Railway detectará que es el frontend

#### Configurar el Frontend:

**a) Root Directory:**
- Click en Settings
- Root Directory: `/` (la raíz, déjalo vacío o escribe `/`)

**b) Build Command:**
- Settings → Build
- Build Command: `npm install && npm run build`
- Watch Paths: `/src/**`

**c) Start Command (servir archivos estáticos):**

Railway necesita servir los archivos compilados. Agrega esto a tu `package.json` principal:

```json
{
  "scripts": {
    "start": "npx serve dist -s -p $PORT"
  },
  "dependencies": {
    "serve": "^14.2.1"
  }
}
```

**d) Variables de Entorno:**
- Click en **"Variables"**
- Agregar:

```bash
VITE_API_URL=https://catarsis-backend-production.up.railway.app
# ☝️ Pega la URL del backend del paso 5d (sin / al final)
```

**e) Generar Dominio Público:**
- Settings → Networking
- Click **"Generate Domain"**
- Copia la URL (ej: `catarsis-production.up.railway.app`)

---

### 7️⃣ Actualizar FRONTEND_URL en Backend

1. Ve al servicio **Backend** en Railway
2. Variables → Edita **FRONTEND_URL**
3. Cambia `${{Railway.STATIC_URL}}` por la URL real del frontend
4. Ejemplo: `https://catarsis-production.up.railway.app`
5. Guarda → Railway redesplegará automáticamente

---

### 8️⃣ Ejecutar Migraciones de Base de Datos

Una vez desplegado el backend:

**Opción A: Desde Railway CLI**
```bash
# Instalar Railway CLI
brew install railway

# Login
railway login

# Link al proyecto
railway link

# Ejecutar seed
railway run npm run seed:plans
```

**Opción B: Desde el Dashboard**
1. Ve al servicio Backend
2. Click en **"Settings"** → **"Deploy"**
3. En **"Custom Start Command"** temporalmente pon:
   ```
   npm run seed:plans && npm run start
   ```
4. Esto ejecutará el seed en el próximo deploy
5. Después de que funcione, regresa el comando a: `npm run start`

---

### 9️⃣ Verificar que Todo Funciona

```bash
# Probar backend
curl https://tu-backend.railway.app/api/health

# Debería responder:
{"status":"ok","timestamp":"..."}

# Abrir frontend en navegador
open https://tu-frontend.railway.app
```

---

## 🎯 Resumen de URLs

Después de todo, tendrás:

| Servicio | URL | Propósito |
|----------|-----|-----------|
| PostgreSQL | Internal | Base de datos (solo acceso interno) |
| Backend | `https://catarsis-backend-xxx.railway.app` | API REST |
| Frontend | `https://catarsis-xxx.railway.app` | Sitio web público |

---

## 🔧 Variables de Entorno Finales

### Backend (3 variables):
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...  # Auto-generado por Railway
JWT_SECRET=tu_secret_de_64_caracteres
FRONTEND_URL=https://catarsis-production.up.railway.app
```

### Frontend (1 variable):
```bash
VITE_API_URL=https://catarsis-backend-production.up.railway.app
```

---

## 🔄 Cómo Desplegar Cambios

Una vez configurado, cada vez que quieras actualizar:

```bash
# Hacer cambios
git add .
git commit -m "Nuevos cambios"
git push

# Railway desplegará automáticamente ambos servicios
# Frontend: si detecta cambios en /src
# Backend: si detecta cambios en /server/src
```

---

## 💰 Costos

**Plan Gratuito:**
- $5 de crédito mensual gratis
- Suficiente para:
  - 1 PostgreSQL pequeño
  - 2 servicios (backend + frontend)
  - ~500 horas de cómputo al mes

**Plan Hobby ($5/mes):**
- Crédito de $5 incluido
- Sin límite de proyectos
- Mejor rendimiento

**Plan Pro ($20/mes):**
- $20 de crédito incluido
- Prioridad en recursos
- Métricas avanzadas

---

## 📊 Monitoreo

### Ver Logs:
1. Dashboard de Railway
2. Click en el servicio (Backend o Frontend)
3. Pestaña **"Logs"**
4. Logs en tiempo real

### Ver Métricas:
- CPU, memoria, network
- Pestaña **"Metrics"**

### Reiniciar Servicio:
- Settings → Restart

---

## 🐛 Troubleshooting

### Error: "Cannot connect to database"
```bash
# Verificar DATABASE_URL
# En Railway: Backend → Variables → DATABASE_URL
# Debe empezar con: postgresql://
```

### Error: "CORS policy blocked"
```bash
# Verificar que FRONTEND_URL en backend sea correcto
# Debe coincidir exactamente con la URL del frontend
```

### Frontend muestra "Cannot GET /"
```bash
# Verificar que el Start Command sea:
npx serve dist -s -p $PORT

# El flag -s es crucial para SPA routing
```

### Backend no inicia
```bash
# Revisar logs
# Verificar que package.json tenga:
"start": "node dist/index.js"

# Y que exista el build:
"build": "tsc"
```

---

## 🎁 Extras

### Dominio Personalizado:
1. Compra dominio (Namecheap, GoDaddy, etc.)
2. Railway → Frontend → Settings → Domains
3. Add Custom Domain: `catarsis.studio`
4. Configurar DNS según instrucciones
5. SSL automático en ~1 hora

### Variables de Entorno Compartidas:
Railway permite crear variables compartidas entre servicios:
1. Project Settings → Shared Variables
2. Útil para valores que usan múltiples servicios

### Webhooks:
Notificaciones cuando ocurre un deploy:
1. Settings → Webhooks
2. Agregar URL (Slack, Discord, etc.)

---

## ✅ Checklist Final

Antes de considerar listo:

- [ ] PostgreSQL desplegado y accesible
- [ ] Backend desplegado con dominio generado
- [ ] Frontend desplegado con dominio generado
- [ ] FRONTEND_URL en backend apunta al dominio del frontend
- [ ] VITE_API_URL en frontend apunta al dominio del backend
- [ ] Seed de planes ejecutado (`/api/plans` responde)
- [ ] Registro de usuario funciona
- [ ] Login funciona
- [ ] Bookings pueden crearse
- [ ] SSL (HTTPS) activo en ambos dominios

---

## 🆘 Soporte

**Documentación oficial:**
- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

**Si algo falla:**
1. Revisar logs en Railway Dashboard
2. Verificar variables de entorno
3. Probar endpoints con curl
4. Revisar que Build Command y Start Command sean correctos

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu aplicación estará 100% en producción en Railway con:
- ✅ HTTPS automático
- ✅ Deploy automático con git push
- ✅ Base de datos PostgreSQL
- ✅ Logs y métricas
- ✅ $5 gratis cada mes

**URLs finales para compartir:**
- Sitio web: `https://catarsis-production.up.railway.app`
- API: `https://catarsis-backend-production.up.railway.app/api`
