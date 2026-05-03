# Quest Engine — Spec

App de rotina gamificada para quem tem agenda apertada. Foco em **simples, manutenível, útil**.

## Princípios

1. **Uma forma de fazer cada coisa.** Sem flags duplicadas, sem 3 jeitos de completar quest.
2. **Sem feature antes da hora.** Se não é necessário pro usuário usar amanhã, fica fora.
3. **Estado mínimo.** Cada tabela tem propósito claro. Cada coluna usada.
4. **Sem abstração especulativa.** Interface só quando há 2+ implementações reais.

## Conceitos

### Block
Período fixo ocupado da semana. Define janelas livres por exclusão.

### Goal
Objetivo recorrente do usuário. Ex: "Academia 3x/semana", "Estudo 5h/semana".

### Quest
Slot concreto agendado de uma Goal. Ex: "Academia quarta 17:30".

### Streak
Contador consecutivo da Goal. Reseta se semana fecha sem bater target.

Não há XP global, não há Boss Fight, não há freeze_tokens, não há level. Streak + taxa de conclusão = recompensa visível. Adicionar gamificação só quando provar que retenção precisa.

## Fluxo

1. Usuário cadastra Blocks (trabalho, faculdade, sono).
2. Usuário cadastra Goals (frequência semanal + duração da sessão).
3. Domingo 22:00, scheduler gera Quests da próxima semana nas janelas livres.
4. Quest chega → app mostra. Usuário marca feita (ou GitHub marca sozinho se goal vinculada a repo).
5. Domingo 22:00, scheduler avalia semana, atualiza streaks, gera próxima.

Se dia ruim: botão **"pular hoje"** marca quests do dia como skipped sem quebrar streak (limite: 1x por semana).

## Schema

```sql
users (
  id uuid pk,
  email text unique,
  password_hash text,
  timezone text,
  created_at timestamptz
)

blocks (
  id uuid pk,
  user_id uuid fk,
  name text,
  weekdays smallint[],         -- [1..7]
  start_time time,
  end_time time
)

goals (
  id uuid pk,
  user_id uuid fk,
  title text,
  weekly_target smallint,      -- quantas vezes/semana
  session_minutes smallint,    -- duração de cada sessão
  github_repo text null,       -- se preenchido: completa via push
  created_at timestamptz,
  archived_at timestamptz null
)

quests (
  id uuid pk,
  goal_id uuid fk,
  user_id uuid fk,
  scheduled_for timestamptz,
  status text,                 -- 'pending' | 'done' | 'skipped'
  done_at timestamptz null
)

streaks (
  goal_id uuid pk fk,
  current smallint,
  best smallint,
  updated_at timestamptz
)

integrations (
  user_id uuid pk fk,
  github_token_encrypted bytea null
)
```

Notas:
- `streaks` tem PK = goal_id (1:1 com goal). Sem id próprio.
- `integrations` 1:1 com user. Hoje só GitHub. Se Strava entrar, vira tabela separada.
- Sem `boss_fights`, sem `notifications`, sem `quest.completion_source`. Se feita por GitHub, está no log do app, não no schema.

## API

```
POST   /auth/register
POST   /auth/login
GET    /me

GET    /blocks
POST   /blocks
PATCH  /blocks/:id
DELETE /blocks/:id

GET    /goals
POST   /goals
PATCH  /goals/:id
DELETE /goals/:id          -- soft delete via archived_at

GET    /quests?week=current
POST   /quests/:id/done
POST   /quests/skip-today

POST   /integrations/github
DELETE /integrations/github
POST   /webhooks/github
```

Sem `/quests/regenerate`, sem `/quests/:id/skip` individual, sem `/stats` (front calcula a partir de quests).

## Scheduler

Roda 1x por semana (domingo 22:00 timezone do usuário).

```
para cada goal ativa:
  faltam = goal.weekly_target
  janelas = janelas_livres_da_semana(user, exclui blocks)
  para i de 1 até faltam:
    pega janela onde cabe goal.session_minutes
    distribui ao longo dos dias (não amontoa)
    cria quest pending
atualiza streak da semana anterior
```

Algoritmo: greedy simples. Sem ML, sem otimização. Se virar problema, substitui depois.

## Webhook GitHub

Recebe push → procura `goals` com `github_repo = repo` do usuário do token → procura quest `pending` desse goal hoje → marca `done`.

Sem fallback de polling. Webhook falha = usuário marca manual. Resolver depois se for problema real.

## Jobs

| Job | Quando |
|-----|--------|
| `weekly_schedule` | Domingo 22:00 (cron) — gera quests + atualiza streaks |
| `morning_brief` | 07:00 diário (cron) — push com quests do dia |

Só dois. Sem `start_quests` por minuto (quest "começar" é cosmético — UI mostra próxima sem precisar de status `active`). Sem `expire_quests` (no domingo o scheduler avalia tudo).

## Stack

- Go 1.22+ + Chi + sqlc + golang-migrate
- Postgres 16
- Expo (React Native) + TypeScript
- Fly.io + Neon
- Cron: `robfig/cron` rodando dentro do binário (sem worker separado até precisar)

Sem Redis, sem queue. Adiciona quando volume justificar.

## Estrutura de pastas

```
backend/
├── cmd/api/main.go
├── internal/
│   ├── config/         # carrega env
│   ├── http/           # router + handlers + middleware
│   ├── domain/         # User, Block, Goal, Quest, Streak (structs puras)
│   ├── store/          # sqlc generated + queries.sql
│   ├── scheduler/      # weekly_schedule + morning_brief
│   ├── github/         # webhook + oauth
│   └── auth/           # JWT + password hash
├── migrations/
├── sqlc.yaml
├── go.mod
└── Makefile

mobile/
├── app/                # Expo Router screens
├── components/
├── lib/                # api client, auth storage
└── app.json
```

Sem `internal/integrations/` genérico. Hoje é GitHub. Vira `internal/integrations/` quando tiver 2+.

## MVP (3 semanas part-time)

**Semana 1**
- Migrations + sqlc + auth (register/login/JWT)
- CRUD Blocks + Goals
- Expo: telas auth + lista blocks + lista goals

**Semana 2**
- Scheduler weekly + cron
- CRUD Quests (listar + marcar done + skip-today)
- Expo: tela Home (quests do dia) + tela Semana

**Semana 3**
- GitHub OAuth + webhook
- Streaks (calcular no scheduler)
- Push notifications (morning_brief)
- Deploy

## Fora de escopo (e por que)

- Strava/Google Fit/HealthKit — só GitHub no MVP. Add quando alguém pedir.
- XP/Level/Boss Fight — gamificação extra. Streak + done/total já dá feedback.
- ML scheduling — greedy resolve 99% dos casos.
- Web app — mobile cobre o uso real.
- Multi-idioma — PT-BR só.
- Tema dark/light dinâmico — um tema só, escolhido bem.

## Decisões registradas

| Decisão | Razão |
|---------|-------|
| Quest sem status `active` | UI infere "próxima" pelo `scheduled_for`. Estado a menos. |
| Skip por dia (não por quest) | 99% dos "dias ruins" pulam tudo. Granularidade extra não vale complexidade. |
| Streak por goal, não global | Streak global esconde info. Por goal é honesto. |
| Cron no binário | Sem orquestrador externo até justificar. |
| Sem soft delete em quest | Quest é histórico. Goal arquiva (preserva quests passadas). |
| GitHub token no banco (criptografado) | OAuth refresh requer persistência. AES-GCM com chave em env. |
