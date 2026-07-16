# Plan de Implementación — App de Finanzas Personales

## 1. Objetivo del producto

Una app (mobile + web) para llevar el control financiero personal, pensada para alguien que:
- Cobra **por semana** (jornal/changas/freelance) pero necesita pensar su plata **por mes**.
- Quiere cargar ingresos rápido (ej: una transferencia que le llega el viernes).
- Quiere que los gastos se **clasifiquen solos** (o con mínima fricción) en categorías.
- Necesita un resumen claro: "¿cómo vengo este mes?" en 5 segundos.

**Principio de diseño:** la unidad real de ingreso es la **semana**, pero la unidad de decisión es el **mes**. Todo el modelo de datos y la UI están armados alrededor de esa tensión.

---

## 2. Stack técnico recomendado

Para cubrir mobile + web con un solo código base y equipo chico:

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | **React + React Native (Expo)** compartiendo lógica con `expo-router` + `react-native-web`, o alternativamente **Flutter** | Un solo código para iOS/Android/Web. Si el equipo ya sabe React, Expo es más rápido de arrancar. |
| Estado | **Zustand** o **Redux Toolkit** | Estado simple, sin boilerplate innecesario |
| Backend | **Node.js + Express (o NestJS)** | Fácil de mantener, tipado con TypeScript |
| Base de datos | **PostgreSQL** | Relacional, ideal para transacciones financieras y reportes por fecha |
| ORM | **Prisma** | Migraciones simples, tipado automático |
| Auth | **Auth0 / Supabase Auth / Firebase Auth** | No reinventar login, soporte biométrico en mobile |
| Sync offline | **SQLite local (WatermelonDB o expo-sqlite)** + sync con backend | Poder cargar un gasto sin señal y que sincronice después |
| Clasificador de gastos | Reglas + ML liviano (ver sección 5) | Empezar con reglas, escalar a ML si hace falta |
| Notificaciones push | Firebase Cloud Messaging | Recordatorios de carga de gastos, alertas de presupuesto |
| Gráficos | Victory Native / Recharts (web) | Resúmenes visuales de gastos por categoría |

**Alternativa más simple para un MVP solo-founder:** Next.js (web) + Capacitor (empaqueta el mismo web app como app nativa) + Supabase (DB + Auth + API autogenerada). Se sacrifica un poco de "nativeness" pero se gana muchísima velocidad de desarrollo.

---

## 3. Modelo de datos (core)

```
User
 ├─ id, nombre, email, moneda_default (ARS/USD), fecha_inicio_ciclo (día que empieza su "semana laboral")

IncomeSource
 ├─ id, user_id, nombre ("Sueldo changa", "Freelance X"), tipo ("semanal","mensual","variable")

Transaction
 ├─ id, user_id
 ├─ tipo: "ingreso" | "gasto"
 ├─ monto, moneda
 ├─ fecha
 ├─ metodo: "transferencia" | "efectivo" | "tarjeta_debito" | "tarjeta_credito" | "otro"
 ├─ category_id (nullable si es ingreso)
 ├─ income_source_id (nullable si es gasto)
 ├─ nota
 ├─ semana_iso (calculado: año-semana ISO, ej "2026-W29")
 ├─ mes (calculado: "2026-07")
 ├─ origen_carga: "manual" | "importado" | "recurrente"

Category
 ├─ id, nombre, icono, color, tipo ("fijo","variable","hormiga")
 ├─ reglas_keywords (array de strings para el clasificador)

Budget (opcional, v2)
 ├─ id, user_id, category_id, mes, monto_limite

RecurringRule (v2)
 ├─ id, user_id, tipo, monto, frecuencia ("semanal","mensual"), category_id/income_source_id
```

**Clave de diseño:** cada `Transaction` se guarda con fecha exacta, pero se le calculan dos campos derivados (`semana_iso` y `mes`) al insertarla. Así, el resumen semanal y el mensual son solo dos `GROUP BY` distintos sobre la misma tabla — no hay que duplicar datos ni mantener dos modelos separados.

---

## 4. Funcionalidades principales

### 4.1 Resumen del mes (pantalla principal)
- Total ingresos del mes / total gastos del mes / balance.
- Comparación con el mes anterior (▲/▼ %).
- Desglose de ingresos **por semana dentro del mes** (barra o timeline con 4-5 bloques semanales).
- Gráfico de gastos por categoría (donut o barras).
- Alertas: "vas 20% arriba de lo que gastás normalmente en 'salidas'".

### 4.2 Vista semanal
- Pensada para el día de cobro: "esta semana cobraste $X, gastaste $Y".
- Botón grande "Agregar ingreso de esta semana" (accesible en 1 tap).
- Historial de semanas anteriores, navegable con swipe/flechas.

### 4.3 Carga de ingresos
- Botón flotante "+" → elegir "Ingreso" o "Gasto".
- Ingreso: monto, fuente (dropdown editable: "changa", "transferencia de Juan", "freelance"), fecha, método, nota opcional.
- Detección automática de "se repite": si cargó 3 viernes seguidos un ingreso similar, sugiere crear una regla recurrente.

### 4.4 Carga y clasificación de gastos
- Alta rápida: monto + fecha (hoy por default) + categoría.
- **Clasificador automático:**
  - Nivel 1 (MVP): reglas por palabra clave en la nota/comercio (ej: "Rappi" → Comida, "Uber" → Transporte).
  - Nivel 2: aprendizaje simple por usuario — si corrige una categoría 2-3 veces para el mismo comercio, la app recuerda la corrección.
  - Nivel 3 (opcional, futuro): importar resumen de tarjeta (PDF/CSV) y auto-categorizar todo en batch, con revisión antes de confirmar.
- Categorías predefinidas editables: Alquiler/Vivienda, Comida, Transporte, Salidas/Ocio, Salud, Servicios, Tarjeta, Ahorro, Otros.
- Posibilidad de marcar un gasto como "fijo" (se repite todos los meses) para que el resumen lo diferencie de gastos variables.

### 4.5 Reportes / comparativas
- Mes vs mes anterior.
- Categoría que más creció.
- Promedio de ingreso semanal (útil porque el trabajo es variable semana a semana).

### 4.6 Configuración
- Definir el "día de cobro" (para que la semana de la app calce con la semana real de cobro, no necesariamente lunes-domingo).
- Moneda, categorías personalizadas, exportar datos (CSV/Excel).

---

## 5. Clasificador de gastos — enfoque recomendado

1. **MVP (reglas):** diccionario `keyword → categoría`, editable por el usuario. Cubre el 80% de los casos con cero complejidad.
2. **v2 (memoria por usuario):** cada vez que el usuario reclasifica manualmente, se guarda `comercio/nota → categoría` como regla personal de mayor prioridad que las reglas globales.
3. **v3 (opcional, si crece):** modelo de clasificación de texto liviano (ej. embeddings + similitud, o un modelo tipo Naive Bayes entrenado con los datos del propio usuario) corriendo en el backend. No hace falta un LLM para esto — sería overkill y caro para algo que se resuelve bien con reglas + memoria.

---

## 6. UI/UX — principios de diseño

- **Todo a un tap:** cargar un ingreso o gasto no debería tomar más de 2 pantallas.
- **Mes por default, semana como detalle:** el usuario abre la app y ve el mes. Puede "entrar" a cualquier semana para el detalle fino.
- **Números grandes, contexto chico:** el balance del mes es lo más grande en pantalla; todo lo demás es secundario.
- **Color con significado:** verde = ingreso/dentro de presupuesto, rojo = gasto/excedido, ámbar = alerta, nunca decorativo.
- **Estados vacíos que invitan a actuar:** si no hay datos en la semana, el mensaje sugiere directamente "agregá tu primer ingreso de la semana".

---

## 7. Roadmap sugerido

**Fase 0 — Setup (1 semana)**
- Repo, CI/CD, esqueleto de app (Expo) + backend (Prisma + Postgres) + Auth.

**Fase 1 — MVP (3-4 semanas)**
- Alta de ingresos y gastos (manual).
- Categorías predefinidas + clasificador por keywords.
- Resumen mensual y semanal básico.
- Login y perfil simple.

**Fase 2 — Inteligencia y comodidad (2-3 semanas)**
- Memoria de reclasificación por usuario.
- Detección de ingresos/gastos recurrentes.
- Gráficos comparativos mes vs mes.
- Notificaciones push (recordatorio semanal de carga).

**Fase 3 — Escalado (según necesidad)**
- Presupuestos por categoría con alertas.
- Importación de resúmenes de tarjeta (CSV/PDF).
- Modo offline completo con sync.
- Multi-moneda / multi-cuenta.

---

## 8. Endpoints principales (API)

```
POST   /auth/login
GET    /me

GET    /transactions?desde=&hasta=&tipo=&category_id=
POST   /transactions
PATCH  /transactions/:id
DELETE /transactions/:id

GET    /summary/month/:yyyy-mm      → totales, por categoría, por semana
GET    /summary/week/:yyyy-Www      → total ingreso, total gasto, detalle

GET    /categories
POST   /categories
PATCH  /categories/:id

POST   /categorize/suggest          → { nota, comercio } → categoría sugerida
```

---

## 9. Métricas de éxito

- Tiempo promedio para cargar un gasto: **< 10 segundos**.
- % de gastos que quedan bien categorizados sin corrección manual (objetivo: >70% a los 2 meses de uso).
- Usuario abre el resumen mensual al menos 1 vez por semana (indicador de que la vista es útil, no solo un depósito de datos).

---

## 10. Siguientes pasos concretos

1. Validar el modelo de datos con 2-3 semanas de gastos reales cargados a mano (aunque sea en una planilla) para ajustar categorías por defecto.
2. Construir el mockup de UI (ver `mockup.html` adjunto) y validarlo con 2-3 personas que cobran por semana.
3. Armar el esqueleto técnico (Fase 0) y arrancar MVP.
