package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"zupu/server/internal/config"
	"zupu/server/internal/db"
	"zupu/server/internal/events"
	"zupu/server/internal/handlers"
	"zupu/server/internal/httpx"
	"zupu/server/internal/middleware"
	"zupu/server/internal/repo"
)

func main() {
	if err := run(); err != nil {
		slog.Error("服务启动失败", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	if pool != nil {
		defer pool.Close()
	}
	server := &http.Server{Addr: cfg.HTTPAddr, Handler: router(pool, cfg), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		slog.Info("后端服务已启动", "addr", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("HTTP 服务异常退出", "error", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}

func router(pool *pgxpool.Pool, cfg config.Config) http.Handler {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.Recovery(), middleware.CORS(cfg.AllowedOrigins))
	r.NoRoute(httpx.NotFound)
	repository := repo.New(pool)
	hub := events.NewHub()
	authHandler := handlers.NewAuthHandler(repository, cfg)
	accountHandler := handlers.NewAccountHandler(repository, cfg, hub)
	memberHandler := handlers.NewMemberHandler(repository, cfg, hub)
	ritualHandler := handlers.NewRitualHandler(repository, hub)
	draftHandler := handlers.NewDraftHandler(repository, hub)
	assetHandler := handlers.NewAssetHandler(repository, cfg, hub)
	noticeHandler := handlers.NewNoticeHandler(repository, hub)
	health := func(c *gin.Context) {
		if pool != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
			defer cancel()
			if err := pool.Ping(ctx); err != nil {
				httpx.Abort(c, http.StatusServiceUnavailable, "database_unavailable", "数据库不可用")
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	}
	r.GET("/healthz", health)
	api := r.Group("/api")
	api.GET("/healthz", health)
	api.POST("/auth/login", authHandler.Login)
	api.POST("/auth/sign-up", accountHandler.SignUp)
	api.POST("/auth/signup", accountHandler.SignUp)
	api.POST("/auth/register", accountHandler.SignUp)
	authed := api.Group("", middleware.Auth(repository))
	authed.GET("/auth/me", authHandler.Me)
	authed.POST("/auth/logout", authHandler.Logout)
	authed.PUT("/account/phone", accountHandler.UpdatePhone)
	approved := authed.Group("", middleware.RequireApproved())
	approved.GET("/events", middleware.RequireFamilyEditor(), noticeHandler.Events)
	approved.GET("/admin/notices", middleware.RequireFamilyEditor(), noticeHandler.Counts)
	approved.GET("/admin/accounts", middleware.RequireAdmin(), accountHandler.Pending)
	approved.GET("/admin/accounts/pending", middleware.RequireAdmin(), accountHandler.Pending)
	approved.PUT("/admin/accounts/:id/status", middleware.RequireAdmin(), accountHandler.UpdateStatus)
	approved.POST("/admin/accounts/:id/approve", middleware.RequireAdmin(), accountHandler.Approve)
	approved.POST("/admin/accounts/:id/reject", middleware.RequireAdmin(), accountHandler.Reject)
	approved.PUT("/admin/accounts/approve", middleware.RequireAdmin(), accountHandler.Approve)
	approved.POST("/admin/accounts/approve", middleware.RequireAdmin(), accountHandler.Approve)
	approved.POST("/admin/accounts/reject", middleware.RequireAdmin(), accountHandler.Reject)
	approved.PUT("/admin/accounts/:id/reject", middleware.RequireAdmin(), accountHandler.Reject)
	approved.GET("/admin/member-options", memberHandler.Options)
	approved.GET("/family-members/options", memberHandler.Options)
	approved.GET("/members", memberHandler.List)
	approved.GET("/family-members", memberHandler.List)
	approved.GET("/members/graph", memberHandler.All)
	approved.GET("/family-members/graph", memberHandler.All)
	approved.GET("/members/:id", memberHandler.Get)
	approved.GET("/family-members/:id", memberHandler.Get)
	approved.GET("/members/:id/account", middleware.RequireAdmin(), memberHandler.Account)
	approved.GET("/family-members/:id/account", middleware.RequireAdmin(), memberHandler.Account)
	approved.GET("/members/:id/assets", assetHandler.List)
	approved.GET("/assets/:assetId/download", assetHandler.Download)
	approved.GET("/drafts/mine", draftHandler.Mine)
	approved.POST("/drafts", draftHandler.Submit)
	approved.DELETE("/drafts/:id", draftHandler.Withdraw)
	approved.GET("/drafts/pending", middleware.RequireFamilyEditor(), draftHandler.Pending)
	approved.POST("/drafts/:id/approve", middleware.RequireFamilyEditor(), draftHandler.Approve)
	approved.POST("/drafts/:id/reject", middleware.RequireFamilyEditor(), draftHandler.Reject)
	approved.GET("/me/profile-context", draftHandler.Mine)
	approved.PUT("/me/member-change-draft", draftHandler.Submit)
	approved.DELETE("/me/member-change-draft/:id", draftHandler.Withdraw)
	approved.GET("/review/member-changes", middleware.RequireFamilyEditor(), draftHandler.Pending)
	approved.PUT("/review/member-changes/:id/status", middleware.RequireFamilyEditor(), draftHandler.UpdateStatus)
	approved.GET("/rituals", ritualHandler.List)
	approved.GET("/rituals/:memberId", ritualHandler.Get)
	approved.GET("/me/drafts", draftHandler.Mine)
	approved.POST("/me/member-change-requests", draftHandler.Submit)
	approved.POST("/me/member-change-requests/:id/withdraw", draftHandler.Withdraw)
	approved.GET("/review/member-change-requests", middleware.RequireFamilyEditor(), draftHandler.Pending)
	approved.POST("/review/member-change-requests/:id/approve", middleware.RequireFamilyEditor(), draftHandler.Approve)
	approved.POST("/review/member-change-requests/:id/reject", middleware.RequireFamilyEditor(), draftHandler.Reject)
	editor := approved.Group("", middleware.RequireFamilyEditor())
	editor.POST("/members", memberHandler.Create)
	editor.POST("/family-members", memberHandler.Create)
	editor.PUT("/members/:id", memberHandler.Update)
	editor.PUT("/family-members/:id", memberHandler.Update)
	editor.PATCH("/members/:id", memberHandler.Update)
	editor.DELETE("/members", middleware.RequireAdmin(), memberHandler.Delete)
	editor.DELETE("/family-members", middleware.RequireAdmin(), memberHandler.Delete)
	editor.POST("/members/import", middleware.RequireAdmin(), memberHandler.BatchImport)
	editor.POST("/family-members/batch", middleware.RequireAdmin(), memberHandler.BatchImport)
	editor.POST("/imports/archive", middleware.RequireAdmin(), assetHandler.ArchiveImport)
	editor.POST("/members/:id/assets", assetHandler.Upload)
	editor.DELETE("/assets/:assetId", assetHandler.Delete)
	editor.PUT("/rituals/:memberId", ritualHandler.Save)
	editor.DELETE("/rituals/:memberId", ritualHandler.Delete)
	return r
}
