package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"zupu/server/internal/events"
	"zupu/server/internal/httpx"
	"zupu/server/internal/repo"
)

type NoticeHandler struct {
	repo *repo.Repository
	hub  *events.Hub
}

func NewNoticeHandler(repository *repo.Repository, hub *events.Hub) *NoticeHandler {
	return &NoticeHandler{repo: repository, hub: hub}
}

func (h *NoticeHandler) Counts(c *gin.Context) {
	counts, err := h.repo.BackofficeCounts(c.Request.Context())
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "counts_failed", "读取待办数量失败")
		return
	}
	c.JSON(http.StatusOK, counts)
}

func (h *NoticeHandler) Events(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	if counts, err := h.repo.BackofficeCounts(c.Request.Context()); err == nil {
		_, _ = fmt.Fprintf(c.Writer, "event: notice\ndata: {\"pending_accounts\":%d,\"pending_member_changes\":%d,\"total\":%d}\n\n", counts["pending_accounts"], counts["pending_member_changes"], counts["total"])
	}
	c.Writer.Flush()
	ch := h.hub.Subscribe()
	defer h.hub.Unsubscribe(ch)
	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-c.Request.Context().Done():
			return
		case message := <-ch:
			_, _ = fmt.Fprintf(c.Writer, "event: notice\ndata: %s\n\n", message)
			c.Writer.Flush()
		case <-heartbeat.C:
			_, _ = fmt.Fprint(c.Writer, ": heartbeat\n\n")
			c.Writer.Flush()
		}
	}
}
