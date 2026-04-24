package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"zupu/server/internal/auth"
	"zupu/server/internal/config"
	"zupu/server/internal/events"
	"zupu/server/internal/httpx"
	"zupu/server/internal/middleware"
	"zupu/server/internal/repo"
)

type AccountHandler struct {
	repo *repo.Repository
	cfg  config.Config
	hub  *events.Hub
}

func NewAccountHandler(repository *repo.Repository, cfg config.Config, hub *events.Hub) *AccountHandler {
	return &AccountHandler{repo: repository, cfg: cfg, hub: hub}
}

type signUpRequest struct {
	RealName string `json:"realName"`
	IDCard   string `json:"idCard"`
}

func (h *AccountHandler) SignUp(c *gin.Context) {
	var input signUpRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "请填写注册信息")
		return
	}
	if message := auth.ValidateIdentity(input.RealName, input.IDCard); message != "" {
		httpx.Abort(c, http.StatusBadRequest, "invalid_identity", message)
		return
	}
	card := auth.NormalizeIDCard(input.IDCard)
	hash := auth.HashIDCard(card, h.cfg.IDHashSalt)
	if existing, err := h.repo.ProfileByHash(c.Request.Context(), hash); err == nil {
		if existing.Status == "pending" {
			httpx.Abort(c, http.StatusConflict, "account_pending", "账号正在审核，请直接登录查看状态")
			return
		}
		httpx.Abort(c, http.StatusConflict, "account_exists", "该身份已存在，请直接登录")
		return
	} else if !errors.Is(err, repo.ErrNotFound) {
		httpx.Abort(c, http.StatusInternalServerError, "signup_failed", "注册失败，请稍后重试")
		return
	}
	passwordHash, err := auth.HashPassword(card)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "signup_failed", "注册失败，请稍后重试")
		return
	}
	profile, err := h.repo.CreateAccount(c.Request.Context(), repo.NewAccountInput{Username: "acct_" + hash[:16], PasswordHash: passwordHash, RealName: strings.TrimSpace(input.RealName), RealNameNormalized: auth.NormalizeRealName(input.RealName), IDCardValue: card, IDCardHash: hash, IDCardMasked: auth.MaskIDCard(card), Role: "member", Status: "pending"})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httpx.Abort(c, http.StatusConflict, "account_exists", "该身份已存在，请直接登录")
			return
		}
		httpx.Abort(c, http.StatusInternalServerError, "signup_failed", "注册失败，请稍后重试")
		return
	}
	publishCounts(h.repo, h.hub)
	c.JSON(http.StatusOK, gin.H{"profile": profile})
}

func (h *AccountHandler) Pending(c *gin.Context) {
	items, err := h.repo.ListPendingAccounts(c.Request.Context())
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "accounts_failed", "读取待审核账号失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

type accountReviewRequest struct {
	AccountID string `json:"accountId"`
	MemberID  int64  `json:"memberId"`
	Role      string `json:"role"`
	Status    string `json:"status"`
}

func (h *AccountHandler) UpdateStatus(c *gin.Context) {
	var input accountReviewRequest
	_ = c.ShouldBindJSON(&input)
	if input.Status == "rejected" {
		h.rejectWithInput(c, input)
		return
	}
	h.approveWithInput(c, input)
}

func (h *AccountHandler) Approve(c *gin.Context) {
	var input accountReviewRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "缺少账号标识")
		return
	}
	h.approveWithInput(c, input)
}

func (h *AccountHandler) approveWithInput(c *gin.Context, input accountReviewRequest) {
	if input.AccountID == "" {
		input.AccountID = c.Param("id")
	}
	if input.AccountID == "" {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "缺少账号标识")
		return
	}
	if input.Role == "" {
		input.Role = "member"
	}
	if input.Role != "member" && input.Role != "editor" {
		httpx.Abort(c, http.StatusBadRequest, "invalid_role", "待审核账号只能批准为成员或编辑员")
		return
	}
	if input.MemberID <= 0 {
		httpx.Abort(c, http.StatusBadRequest, "member_required", "批准账号前必须绑定成员")
		return
	}
	account, _ := middleware.Current(c)
	profile, err := h.repo.ApproveAccount(c.Request.Context(), input.AccountID, input.MemberID, input.Role, account.UserID)
	if errors.Is(err, repo.ErrNotFound) {
		httpx.Abort(c, http.StatusNotFound, "account_not_found", "待审核账号不存在")
		return
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "approve_failed", "批准账号失败")
		return
	}
	publishCounts(h.repo, h.hub)
	c.JSON(http.StatusOK, gin.H{"profile": profile})
}

func (h *AccountHandler) Reject(c *gin.Context) {
	var input accountReviewRequest
	_ = c.ShouldBindJSON(&input)
	h.rejectWithInput(c, input)
}

func (h *AccountHandler) rejectWithInput(c *gin.Context, input accountReviewRequest) {
	if input.AccountID == "" {
		input.AccountID = c.Param("id")
	}
	if input.AccountID == "" {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "缺少账号标识")
		return
	}
	account, _ := middleware.Current(c)
	profile, err := h.repo.RejectAccount(c.Request.Context(), input.AccountID, account.UserID)
	if errors.Is(err, repo.ErrNotFound) {
		httpx.Abort(c, http.StatusNotFound, "account_not_found", "待审核账号不存在")
		return
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "reject_failed", "拒绝账号失败")
		return
	}
	publishCounts(h.repo, h.hub)
	c.JSON(http.StatusOK, gin.H{"profile": profile})
}

type phoneRequest struct {
	Phone string `json:"phone"`
}

func (h *AccountHandler) UpdatePhone(c *gin.Context) {
	var input phoneRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "请填写手机号")
		return
	}
	phone := strings.TrimSpace(input.Phone)
	if len(phone) != 11 || phone[0] != '1' {
		httpx.Abort(c, http.StatusBadRequest, "invalid_phone", "请输入正确的11位手机号")
		return
	}
	account, _ := middleware.Current(c)
	if err := h.repo.UpdateProfilePhone(c.Request.Context(), account.Profile.ID, phone); err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "phone_failed", "保存手机号失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
