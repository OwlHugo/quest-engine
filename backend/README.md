# Quest Engine — Backend (Go)

## Setup

Pré-requisitos:
- Go 1.22+
- Docker (para Postgres local)
- [sqlc](https://docs.sqlc.dev/en/stable/overview/install.html)
- [golang-migrate](https://github.com/golang-migrate/migrate/tree/master/cmd/migrate)

```bash
cp .env.example .env
make tidy
make db-up
make migrate-up
make gen        # gera código sqlc
make run
```

## Layout

```
backend/
├── cmd/api/main.go                # entrypoint
├── internal/
│   ├── auth/                      # JWT + bcrypt
│   ├── config/                    # env loader
│   ├── github/                    # AES-GCM + HMAC verify
│   ├── http/                      # router + handlers
│   ├── scheduler/                 # cron + PlanWeek
│   └── store/                     # sqlc generated + queries.sql
├── migrations/                    # SQL up/down
├── sqlc.yaml
├── docker-compose.yml
└── Makefile
```

## Endpoints

Públicos:
- `POST /auth/register` — `{ email, password, timezone? }`
- `POST /auth/login` — `{ email, password }`
- `POST /webhooks/github` — receber push events
- `GET /healthz`

Autenticados (Bearer JWT):
- `GET /me`
- `GET|POST|PATCH|DELETE /blocks[/:id]`
- `GET|POST|PATCH|DELETE /goals[/:id]` (delete = arquivar)
- `GET /quests?week=current|next`
- `POST /quests/:id/done`
- `POST /quests/skip-today` (limite 1x/semana)
- `POST|DELETE /integrations/github`

## Cron

`weekly_schedule` — domingo 22:00 (UTC do servidor). Por usuário: avalia streak da semana passada, gera quests da próxima semana.

## Testes

```bash
make test
```

Cobre: `PlanWeek` (distribuição em janelas livres), AES-GCM round-trip, HMAC GitHub.
