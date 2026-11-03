# Thin convenience wrappers for macOS and Linux. On Windows (no make), run the
# docker compose commands from README.md directly; they work the same in PowerShell.
COMPOSE ?= docker compose

.PHONY: help up up-all down build ps logs

help: ## List the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-8s %s\n", $$1, $$2}'

up: ## Build and start the brief set and the gateway
	$(COMPOSE) up -d --build --wait

up-all: ## Build and start both sets and the gateway
	$(COMPOSE) --profile ridge up -d --build --wait

down: ## Stop and remove both sets (volumes are kept)
	$(COMPOSE) --profile ridge down

build: ## Build every image, both sets
	$(COMPOSE) --profile ridge build

ps: ## Show container status
	$(COMPOSE) --profile ridge ps

logs: ## Follow the logs of every running service
	$(COMPOSE) --profile ridge logs -f --tail=100
