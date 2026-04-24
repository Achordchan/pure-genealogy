package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func Abort(c *gin.Context, status int, code string, message string) {
	c.AbortWithStatusJSON(status, ErrorResponse{
		Error: ErrorBody{Code: code, Message: message},
	})
}

func NotFound(c *gin.Context) {
	Abort(c, http.StatusNotFound, "not_found", "接口不存在")
}
