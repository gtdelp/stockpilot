# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [Versionado Semántico](https://semver.org/lang/es/).

## [1.0.1] - 2026-10-31

### Añadido

- Verificación automática de cada despliegue de producción: rutas principales, cabeceras de seguridad e informe Lighthouse (móvil y escritorio) guardado como artefacto.
- Etiquetado y Release de GitHub automáticos al publicar una versión en `main`.

## [1.0.0] - 2026-10-31

### Añadido

- Arquitectura MVVM con Ionic 9 + Angular 22 (standalone, zoneless, `OnPush`) y NgRx SignalStore.
- Autenticación con Firebase Auth (JWT), guards `canMatch` por rol e interceptores HTTP de token y errores.
- Formularios reactivos tipados con validación asíncrona de correo y SKU contra la API.
- Componentes reutilizables: tabla de datos avanzada, tarjeta KPI, tarjeta de gráfico, cabecera de página, estados vacíos y exportación.
- API REST serverless (Vercel) sobre PostgreSQL (Neon), con autorización por rol en el servidor y pedidos transaccionales.
- Tiempo real con Cloud Firestore: feed de actividad y notificaciones, con reglas de seguridad por rol.
- Cuadro de mando con KPIs, cuatro gráficos interactivos (Chart.js) y filtros en tiempo real.
- Exportación a PDF con diseño y a CSV (RFC 4180, compatible con Excel).
- Diseño mobile-first, modo oscuro y cumplimiento WCAG 2.2 AA.
- Ayuda contextual integrada, manual de usuario, README y documentación Compodoc.
- CI/CD con GitHub Actions (lint, tests unitarios, de API y E2E, axe, Lighthouse CI, gitleaks) y despliegue en Vercel condicionado a los tests.
- PWA instalable con service worker.
