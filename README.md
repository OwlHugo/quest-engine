# Quest Engine

App de rotina gamificada para agenda apertada. Usuário define blocos fixos (trabalho, faculdade, sono) e metas semanais. Sistema agenda quests nas janelas livres. Streak por meta motiva consistência.

Princípio: **simples e manutenível**. Sem feature antes da hora.

## Stack

- Backend: Go 1.22 (Chi + sqlc + Postgres)
- Mobile: Expo (React Native + TypeScript)
- Deploy: Fly.io + Neon

## Estrutura

```
quest-engine/
├── backend/
├── mobile/
└── docs/SPEC.md
```

Ver [docs/SPEC.md](docs/SPEC.md) para spec funcional.
