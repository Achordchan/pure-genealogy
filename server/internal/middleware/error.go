package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"zupu/server/internal/httpx"
)

func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, _ any) {
		httpx.Abort(c, http.StatusInternalServerError, "internal_error", "服务器内部错误")
	})
}
