package handlers

import (
	"context"
	"encoding/json"

	"zupu/server/internal/events"
	"zupu/server/internal/repo"
)

func publishCounts(repository *repo.Repository, hub *events.Hub) {
	counts, err := repository.BackofficeCounts(context.Background())
	if err != nil {
		return
	}
	bytes, err := json.Marshal(counts)
	if err == nil {
		hub.Publish(string(bytes))
	}
}
