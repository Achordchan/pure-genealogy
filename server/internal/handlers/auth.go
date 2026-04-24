package handlers

import (
	"errors"
	"net"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"zupu/server/internal/auth"
	"zupu/server/internal/config"
	"zupu/server/internal/httpx"
	"zupu/server/internal/middleware"
	"zupu/server/internal/repo"
)

type AuthHandler struct {
	repo *repo.Repository
	cfg  config.Config
}

func NewAuthHandler(repository *repo.Repository, cfg config.Config) *AuthHandler {
	return &AuthHandler{repo: repository, cfg: cfg}
}

type loginRequest struct {
	RealName string `json:"realName"`
	IDCard   string `json:"idCard"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input loginRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "请填写登录信息")
		return
	}
	if message := auth.ValidateIdentity(input.RealName, input.IDCard); message != "" {
		httpx.Abort(c, http.StatusBadRequest, "invalid_identity", message)
		return
	}
	idHash := auth.HashIDCard(input.IDCard, h.cfg.IDHashSalt)
	profile, passwordHash, err := h.repo.ProfileByIDHash(c.Request.Context(), idHash)
	if errors.Is(err, repo.ErrNotFound) || !auth.CheckPassword(passwordHash, auth.NormalizeIDCard(input.IDCard)) || profile.RealNameNormalized != auth.NormalizeRealName(input.RealName) {
		httpx.Abort(c, http.StatusUnauthorized, "invalid_credentials", "姓名或身份证号不正确")
		return
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "login_failed", "登录失败，请稍后重试")
		return
	}
	token, tokenHash, err := auth.NewToken()
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "session_failed", "创建登录状态失败")
		return
	}
	expiresAt := time.Now().Add(time.Duration(h.cfg.SessionDays) * 24 * time.Hour)
	if err := h.repo.CreateSession(c.Request.Context(), profile.UserID, tokenHash, c.GetHeader("User-Agent"), clientIP(c), expiresAt); err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "session_failed", "创建登录状态失败")
		return
	}
	setSessionCookie(c, token, expiresAt)
	c.JSON(http.StatusOK, gin.H{"profile": profile})
}

func (h *AuthHandler) Me(c *gin.Context) {
	account, ok := middleware.Current(c)
	if !ok {
		httpx.Abort(c, http.StatusUnauthorized, "unauthorized", "请先登录")
		return
	}
	c.JSON(http.StatusOK, account)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	if token, err := c.Cookie(middleware.SessionCookieName); err == nil && token != "" {
		_ = h.repo.RevokeSession(c.Request.Context(), auth.HashToken(token))
	}
	c.SetCookie(middleware.SessionCookieName, "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func setSessionCookie(c *gin.Context, token string, expiresAt time.Time) {
	http.SetCookie(c.Writer, &http.Cookie{Name: middleware.SessionCookieName, Value: token, Path: "/", Expires: expiresAt, HttpOnly: true, SameSite: http.SameSiteLaxMode})
}

func clientIP(c *gin.Context) string {
	ip := net.ParseIP(c.ClientIP())
	if ip == nil {
		return ""
	}
	return ip.String()
}
