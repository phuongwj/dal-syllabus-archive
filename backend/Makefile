-include .env
export

MIGRATIONS_DIR := migrations

.PHONY: migrate-up migrate-down migrate-force

migrate-up:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" down

# usage: make migrate-force VERSION=1
migrate-force:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" force $(VERSION)
