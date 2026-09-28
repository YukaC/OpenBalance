# SPEC — OpenBalance / finanzas personales mensual-first

§G
App finanzas personales: mes calendario = marco decisión (sueldo/presupuesto/saldo). Local-first + sync opcional. Repo `YukaC/OpenBalance` (local dir `AppFinanzas`).

§C
- stack: Next.js 15 App Router · TS · Tailwind 4 · Zustand · Auth.js · Drizzle · Postgres (Neon) · Capacitor opcional · PWA
- default local-first (`openbalance-*` localStorage/IndexedDB) · auth/sync solo con env
- lógica cálculo ! cliente (`src/lib`); backend = CRUD/sync ⊥ recalcular balances
- plan: `docs/IMPLEMENTATION-PLAN.md` · deploy `docs/DEPLOY.md`
- pnpm overrides / CI: ver package + `.github/workflows/ci.yml`

§I
```
cmd: npm run dev|build|lint|typecheck|test
cmd: npm run db:generate|db:migrate
env: DATABASE_URL · NEXT_PUBLIC_AUTH_ENABLED · auth secrets (si sync)
file: src/lib/* · drizzle/*
deploy: Vercel web
```

§V
```
V1: sin AUTH_ENABLED → datos solo browser (⊥ require login)
V2: ∀ balance/resumen → calculado cliente desde store; API ⊥ source of truth math
V3: ∀ migrate prod → review SQL drizzle antes apply
```

§T
```
id|status|task|cites
T1|x|local-first finance UX mensual|§G
T2|x|hygiene deps/CI/security|§C
T3|.|Fase M pay-weeks producto|§G
T4|.|sync multiusuario polish|V1
```

§B
```
id|date|cause|fix
```
