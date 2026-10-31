# Puesta en marcha y despliegue

Guía paso a paso para publicar StockPilot con servicios reales: GitHub, Firebase, Neon y Vercel. Todos los servicios tienen plan gratuito y ninguno pide tarjeta para lo que usa este proyecto.

> **Regla de oro:** ninguna clave se pega en el código ni en el chat. Van en tu `.env` local (que está en `.gitignore`) o en los paneles de Vercel y GitHub.

Tiempo estimado: 45–60 minutos.

---

## 0. Requisitos en tu equipo

- [Node.js 22 LTS](https://nodejs.org) y [Git](https://git-scm.com). En Windows, Git incluye **Git Bash**, que usarás para los scripts.
- [GitHub CLI](https://cli.github.com) (`gh`), con la sesión iniciada mediante `gh auth login`.
- Descomprime el proyecto y, dentro de la carpeta, ejecuta `npm ci`.

## 1. Firebase (autenticación y tiempo real)

1. Entra en <https://console.firebase.google.com> → **Agregar proyecto**. Ponle de nombre `stockpilot` y desactiva Google Analytics.
2. **Authentication** → **Comenzar** → pestaña **Método de acceso** → habilita **Correo electrónico/contraseña**.
3. **Firestore Database** → **Crear base de datos** → ubicación `eur3 (europe-west)` → **modo de producción**.
4. Pestaña **Reglas** de Firestore: borra el contenido, pega el archivo [`firestore.rules`](../firestore.rules) y pulsa **Publicar**.
5. ⚙️ **Configuración del proyecto** → **General** → **Tus apps** → icono web `</>` → registra la app `stockpilot-web` (sin Hosting). Copia los valores de `firebaseConfig`, que necesitarás en los pasos 4 y 5:
   - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
6. ⚙️ **Configuración del proyecto** → **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un JSON. **No lo guardes dentro del proyecto.**
7. Convierte ese JSON a base64 (el valor resultante es `FIREBASE_SERVICE_ACCOUNT_BASE64`):
   - **PowerShell:** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\clave.json")) | Set-Clipboard`
   - **Git Bash / macOS / Linux:** `base64 -w0 clave.json` (en macOS: `base64 -i clave.json`)
8. _(Recomendado)_ En <https://console.cloud.google.com/apis/credentials>, edita la **Browser key** del proyecto → **Restricciones de aplicaciones: sitios web** → añade `http://localhost:4200/*` y, cuando lo tengas, `https://TU-PROYECTO.vercel.app/*`.

## 2. Neon (PostgreSQL)

1. Entra en <https://neon.tech> → **Create project** → nombre `stockpilot`, región **AWS Europe (Frankfurt)**, PostgreSQL 17.
2. En el panel, pulsa **Connect** y copia la cadena de conexión **pooled**: `postgresql://<usuario>:<contraseña>@<host-pooler>.neon.tech/neondb?sslmode=require`. Es tu `DATABASE_URL`.

## 3. Cargar los datos sintéticos

1. Copia `.env.example` como `.env` y rellena **todas** las variables:
   - Las de Firebase (paso 1.5), `FIREBASE_SERVICE_ACCOUNT_BASE64` (paso 1.7) y `DATABASE_URL` (paso 2.2).
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` y `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`: elige tú las credenciales de prueba, por ejemplo `admin@stockpilot-demo.com` y `usuario@stockpilot-demo.com`. Las contraseñas deben tener 8 caracteres o más, con mayúscula, minúscula y número.
2. Ejecuta:

   ```bash
   npm run seed
   ```

   El script crea las tablas, inserta 120 productos, unos 700 pedidos de 24 meses, 12 proveedores y 12 usuarios ficticios, crea las dos cuentas de prueba en Firebase Auth con su rol y prepara el feed de actividad.

3. Comprueba en local que todo funciona: `npm start` y entra con tus credenciales de prueba. Con `npm start` solo se sirve el frontend; para probar también la API en local usa `npx vercel dev` (después del paso 5.2).

## 4. GitHub (repositorio y Git Flow con Pull Requests)

El proyecto ya incluye su historial Git: `main`, `develop`, una rama por funcionalidad, `chore/ci-cd` y `release/1.0.0`. El script siguiente lo publica abriendo y fusionando un **Pull Request por rama**, como pide Git Flow.

1. Crea un repositorio **vacío** en GitHub (sin README ni licencia), por ejemplo `stockpilot`, público o privado. Si es privado, invita al docente como colaborador.
2. En **Git Bash**, desde la carpeta del proyecto:

   ```bash
   bash scripts/publicar-git-flow.sh https://github.com/TU_USUARIO/stockpilot.git
   ```

   El script sube `main` y `develop`, abre un PR por cada `feature/*` hacia `develop` y los fusiona en orden. Se detiene antes de la release para que configures el despliegue.

> Si no puedes usar `gh`, sube las ramas con `git push -u origin --all` y abre y fusiona los PRs a mano desde la web, en el orden que indica el script.

## 5. Vercel (producción)

1. En <https://vercel.com>, inicia sesión con GitHub → **Add New… → Project** → importa `stockpilot`. Vercel instala su app de GitHub si aún no lo está.
2. Deja **Framework Preset: Other**; el resto se lee de `vercel.json`.
3. En **Settings → Environment Variables** (entorno **Production**), añade los 6 valores `FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_BASE64` y `DATABASE_URL`. Sin ellos, la app funciona en modo demostración.
4. Pulsa **Deploy**. Desde ese momento, cada PR genera una _preview_ y cada commit en `main` se publica en producción.
5. En GitHub → **Settings → Branches**, protege `main`: _Require a pull request before merging_ + _Require status checks to pass_ (los tres jobs de **CI**). Así solo llega a producción código con todos los tests en verde.

## 6. Release 1.0.0

```bash
bash scripts/publicar-git-flow.sh --release
```

El script abre el PR `release/1.0.0 → main`, espera a que el CI pase, lo fusiona y crea la etiqueta `v1.0.0`. Vercel despliega `main` y el workflow **Deploy** comprueba que la producción responde.

## 7. Verificación final

- [ ] La URL de producción carga el login y no da error 500 ni pantalla en blanco.
- [ ] El Administrador entra y ve el Cuadro de mando con datos y la actividad en directo.
- [ ] El Usuario estándar entra, ve el Catálogo y al abrir `/panel` recibe un 403.
- [ ] Al recargar una ruta interna (por ejemplo `/pedidos`), la página carga sin error.
- [ ] `https://TU-URL/docs/` muestra la documentación Compodoc.
- [ ] La exportación a CSV y PDF descarga los archivos.

## 8. Informe Lighthouse para la entrega

1. Abre la URL de producción en **Chrome**, en una ventana de incógnito.
2. Abre DevTools (`F12`) → pestaña **Lighthouse** → marca **Accessibility**, **Best Practices**, **SEO** y **Performance** → dispositivo **Mobile** → **Analyze page load**.
3. Usa el menú ⋮ del informe → **Print / Save as PDF**. Repite con **Desktop**.
4. Accesibilidad y Buenas prácticas deben salir en **100**. En local salen 100 en ambos dispositivos.

## 9. Documento de entrega

Rellena [`docs/ENTREGA_PLANTILLA.md`](ENTREGA_PLANTILLA.md) con:

- La URL del repositorio y la URL de producción.
- Las credenciales de prueba de tu `.env` (`SEED_*`).
- Los informes Lighthouse en PDF.
- El enlace a `/docs` y al manual de usuario.

Expórtalo a PDF y comprímelo **solo** en `APELLIDOS_NOMBRE_DI_PROYECTO.zip`.

---

## Solución de problemas

| Síntoma                                                   | Causa probable                                                           | Solución                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| La app sale en «Modo demo» en producción                  | Faltan las variables `FIREBASE_*` en Vercel                              | Añádelas (paso 5.3) y vuelve a desplegar                  |
| Error «Falta la configuración del servidor»               | Falta `DATABASE_URL` o `FIREBASE_SERVICE_ACCOUNT_BASE64` en Vercel       | Revisa el paso 5.3                                        |
| «Tu cuenta no tiene un perfil asociado»                   | El usuario existe en Firebase pero no en PostgreSQL                      | Ejecuta `npm run seed` o crea el usuario desde la app     |
| El feed de actividad dice «Sin conexión»                  | Reglas de Firestore no publicadas o el usuario no tiene el claim `admin` | Publica las reglas (paso 1.4) y vuelve a ejecutar el seed |
| El job **Deploy** falla en `vercel pull`                  | Faltan `VERCEL_*` en los secrets de GitHub                               | Revisa el paso 5.7                                        |
| Login correcto en local con `npm start` pero error de API | `npm start` no ejecuta las funciones serverless                          | Usa `npx vercel dev`                                      |
