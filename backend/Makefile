.PHONY: dev tidy gen migrate-up migrate-down test build run db-up db-down

DB_URL ?= postgres://questengine:questengine@localhost:5432/questengine?sslmode=disable

tidy:
	go mod tidy

gen:
	sqlc generate

migrate-up:
	migrate -path migrations -database "$(DB_URL)" up

migrate-down:
	migrate -path migrations -database "$(DB_URL)" down 1

run:
	go run ./cmd/api

build:
	go build -o bin/api ./cmd/api

test:
	go test ./...

db-up:
	docker compose up -d db

db-down:
	docker compose down
