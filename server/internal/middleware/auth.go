package middleware

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"zupu/server/internal/auth"
	"zupu/server/internal/httpx"
	"zupu/server/internal/model"
	"zupu/server/internal/repo"
)

const SessionCookieName = "zupu_session"
const accountKey = "current_account"

func Auth(repository *repo.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(SessionCookieName)
		if err != nil || token == "" {
			httpx.Abort(c, http.StatusUnauthorized, "unauthorized", "请先登录")
			return
		}
		account, err := repository.ProfileBySession(c.Request.Context(), auth.HashToken(token))
		if errors.Is(err, repo.ErrNotFound) {
			httpx.Abort(c, http.StatusUnauthorized, "unauthorized", "登录状态已失效")
			return
		}
		if err != nil {
			httpx.Abort(c, http.StatusInternalServerError, "session_error", "读取登录状态失败")
			return
		}
		c.Set(accountKey, *account)
		c.Next()
	}
}

func Current(c *gin.Context) (model.CurrentAccount, bool) {
	value, ok := c.Get(accountKey)
	if !ok {
		return model.CurrentAccount{}, false
	}
	account, ok := value.(model.CurrentAccount)
	return account, ok
}

func RequireApproved() gin.HandlerFunc {
	return func(c *gin.Context) {
		account, ok := Current(c)
		if !ok || !auth.IsApproved(account.Profile) {
			httpx.Abort(c, http.StatusForbidden, "account_pending", "当前账号尚未通过审核")
			return
		}
		c.Next()
	}
}

func RequireFamilyEditor() gin.HandlerFunc {
	return func(c *gin.Context) {
		account, ok := Current(c)
		if !ok || !auth.CanManageFamilyMembers(account.Profile) {
			httpx.Abort(c, http.StatusForbidden, "forbidden", "当前账号无权维护族谱数据")
			return
		}
		c.Next()
	}
}

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		account, ok := Current(c)
		if !ok || !auth.CanManageAccounts(account.Profile) {
			httpx.Abort(c, http.StatusForbidden, "forbidden", "仅管理员可以执行此操作")
			return
		}
		c.Next()
	}
}
