package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"zupu/server/internal/auth"
	"zupu/server/internal/events"
	"zupu/server/internal/httpx"
	"zupu/server/internal/middleware"
	"zupu/server/internal/repo"
)

type DraftHandler struct {
	repo *repo.Repository
	hub  *events.Hub
}

func NewDraftHandler(repository *repo.Repository, hub *events.Hub) *DraftHandler {
	return &DraftHandler{repo: repository, hub: hub}
}

type draftRequest struct {
	Payload map[string]interface{} `json:"payload"`
}

func (h *DraftHandler) Submit(c *gin.Context) {
	account, _ := middleware.Current(c)
	if !auth.CanSubmitOwnDraft(account.Profile) {
		httpx.Abort(c, http.StatusForbidden, "forbidden", "当前账号没有可编辑的绑定成员")
		return
	}
	var input draftRequest
	if err := c.ShouldBindJSON(&input); err != nil || input.Payload == nil {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "请填写草稿内容")
		return
	}
	request, err := h.repo.UpsertMemberDraft(c.Request.Context(), account.Profile.ID, *account.Profile.MemberID, input.Payload)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "draft_failed", "草稿提交失败")
		return
	}
	publishCounts(h.repo, h.hub)
	c.JSON(http.StatusOK, gin.H{"request": request})
}

func (h *DraftHandler) Mine(c *gin.Context) {
	account, _ := middleware.Current(c)
	items, err := h.repo.ListMyDrafts(c.Request.Context(), account.Profile.ID)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "drafts_failed", "读取草稿记录失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *DraftHandler) Withdraw(c *gin.Context) {
	account, _ := middleware.Current(c)
	requestID := c.Param("id")
	if requestID == "" {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "缺少变更记录标识")
		return
	}
	if err := h.repo.WithdrawDraft(c.Request.Context(), account.Profile.ID, requestID); errors.Is(err, repo.ErrNotFound) {
		httpx.Abort(c, http.StatusNotFound, "draft_not_found", "未找到该变更记录")
		return
	} else if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "withdraw_failed", "撤回草稿失败")
		return
	}
	publishCounts(h.repo, h.hub)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *DraftHandler) Pending(c *gin.Context) {
	items, err := h.repo.ListPendingDrafts(c.Request.Context())
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "drafts_failed", "读取待审核草稿失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

type reviewDraftRequest struct {
	ReviewComment string `json:"reviewComment"`
	Status        string `json:"status"`
}

func (h *DraftHandler) UpdateStatus(c *gin.Context) {
	var input reviewDraftRequest
	_ = c.ShouldBindJSON(&input)
	status := "approved"
	if input.Status == "rejected" {
		status = "rejected"
	}
	h.reviewWithInput(c, status, input)
}

func (h *DraftHandler) Approve(c *gin.Context) {
	h.review(c, "approved")
}

func (h *DraftHandler) Reject(c *gin.Context) {
	h.review(c, "rejected")
}

func (h *DraftHandler) review(c *gin.Context, status string) {
	var input reviewDraftRequest
	_ = c.ShouldBindJSON(&input)
	h.reviewWithInput(c, status, input)
}

func (h *DraftHandler) reviewWithInput(c *gin.Context, status string, input reviewDraftRequest) {
	requestID := c.Param("id")
	if requestID == "" {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "缺少变更记录标识")
		return
	}
	account, _ := middleware.Current(c)
	request, err := h.repo.ReviewDraft(c.Request.Context(), requestID, status, account.UserID, input.ReviewComment)
	if errors.Is(err, repo.ErrNotFound) {
		httpx.Abort(c, http.StatusNotFound, "draft_not_found", "待审核草稿不存在")
		return
	}
	if err != nil {
		message := "审核草稿失败"
		if status == "approved" {
			message = "批准草稿失败"
		} else if status == "rejected" {
			message = "拒绝草稿失败"
		}
		httpx.Abort(c, http.StatusInternalServerError, "review_failed", message)
		return
	}
	publishCounts(h.repo, h.hub)
	c.JSON(http.StatusOK, gin.H{"request": request})
}
