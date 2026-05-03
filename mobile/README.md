# Quest Engine — Mobile (Expo)

## Setup

```bash
cd mobile
npm install
npx expo start
```

Scan QR code com Expo Go no dispositivo.

## Config

API URL no `app.json` → `expo.extra.apiUrl`. Default: `http://localhost:8080`.

Para testar em device físico apontando pra backend local: troca por IP da máquina (ex: `http://192.168.0.10:8080`).

## Estrutura

```
mobile/
├── app/                       # Expo Router
│   ├── _layout.tsx            # root + auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/
│       ├── _layout.tsx        # tabs
│       ├── index.tsx          # Hoje
│       ├── week.tsx           # Semana
│       ├── goals.tsx
│       ├── blocks.tsx
│       └── profile.tsx
├── lib/
│   ├── api.ts                 # fetch wrapper + secure token
│   ├── auth.tsx               # AuthProvider + useAuth
│   ├── queries.ts             # endpoints tipados
│   └── types.ts               # tipos compartilhados
├── app.json
├── babel.config.js
├── package.json
└── tsconfig.json
```

## Telas

- **Hoje**: lista quests do dia, tap marca done, botão "Hoje tá pesado" pula dia.
- **Semana**: agrupa quests por dia.
- **Metas**: CRUD. Long press arquiva.
- **Blocos**: CRUD agenda fixa. Long press exclui.
- **Perfil**: info + logout.
