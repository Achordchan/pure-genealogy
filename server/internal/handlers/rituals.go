package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"zupu/server/internal/events"
	"zupu/server/internal/httpx"
	"zupu/server/internal/model"
	"zupu/server/internal/repo"
)

type RitualHandler struct {
	repo *repo.Repository
	hub  *events.Hub
}

func NewRitualHandler(repository *repo.Repository, hub *events.Hub) *RitualHandler {
	return &RitualHandler{repo: repository, hub: hub}
}

func (h *RitualHandler) List(c *gin.Context) {
	var generation *int
	if raw := strings.TrimSpace(c.Query("generation")); raw != "" && raw != "all" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			httpx.Abort(c, http.StatusBadRequest, "invalid_generation", "世代参数不正确")
			return
		}
		generation = &value
	}
	items, generations, err := h.repo.ListRituals(c.Request.Context(), c.Query("q"), generation)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "rituals_failed", "读取祭祀资料失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "generations": generations})
}

func (h *RitualHandler) Get(c *gin.Context) {
	memberID, ok := parseID(c, "memberId")
	if !ok {
		return
	}
	detail, err := h.repo.GetRitualDetail(c.Request.Context(), memberID)
	if err == repo.ErrNotFound {
		httpx.Abort(c, http.StatusNotFound, "ritual_not_found", "祭祀成员不存在")
		return
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "ritual_failed", "读取祭祀详情失败")
		return
	}
	c.JSON(http.StatusOK, detail)
}

func (h *RitualHandler) Save(c *gin.Context) {
	memberID, ok := parseID(c, "memberId")
	if !ok {
		return
	}
	var input model.MemberRitual
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "请填写祭祀信息")
		return
	}
	input.MemberID = memberID
	input.CemeteryName = strings.TrimSpace(input.CemeteryName)
	input.Address = strings.TrimSpace(input.Address)
	if input.CemeteryName == "" {
		httpx.Abort(c, http.StatusBadRequest, "cemetery_required", "请填写墓园名称")
		return
	}
	if input.Address == "" {
		httpx.Abort(c, http.StatusBadRequest, "address_required", "请填写详细地址")
		return
	}
	member, err := h.repo.GetMember(c.Request.Context(), memberID)
	if err == repo.ErrNotFound {
		httpx.Abort(c, http.StatusNotFound, "member_not_found", "成员不存在")
		return
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "member_failed", "读取成员失败")
		return
	}
	if member.IsAlive {
		httpx.Abort(c, http.StatusBadRequest, "member_alive", "在世成员不能保存祭祀资料")
		return
	}
	if err := h.repo.UpsertRitual(c.Request.Context(), input); err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "save_failed", "保存祭祀资料失败")
		return
	}
	h.hub.Publish(`{"rituals_changed":true}`)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *RitualHandler) Delete(c *gin.Context) {
	memberID, ok := parseID(c, "memberId")
	if !ok {
		return
	}
	if err := h.repo.DeleteRitual(c.Request.Context(), memberID); err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "delete_failed", "清空祭祀资料失败")
		return
	}
	h.hub.Publish(`{"rituals_changed":true}`)
	c.JSON(http.StatusOK, gin.H{"success": true})
}
