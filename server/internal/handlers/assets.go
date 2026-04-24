package handlers

import (
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"zupu/server/internal/config"
	"zupu/server/internal/events"
	"zupu/server/internal/httpx"
	"zupu/server/internal/middleware"
	"zupu/server/internal/model"
	"zupu/server/internal/repo"
)

const memberAssetBucket = "member-assets"
const importArchiveBucket = "genealogy-archives"

type AssetHandler struct {
	repo *repo.Repository
	cfg  config.Config
	hub  *events.Hub
}

func NewAssetHandler(repository *repo.Repository, cfg config.Config, hub *events.Hub) *AssetHandler {
	return &AssetHandler{repo: repository, cfg: cfg, hub: hub}
}

func (h *AssetHandler) List(c *gin.Context) {
	memberID, ok := parseID(c, "id")
	if !ok {
		return
	}
	scope := normalizeAssetScope(c.Query("assetScope"))
	items, err := h.repo.ListAssets(c.Request.Context(), memberID, scope)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "assets_failed", "读取附件失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *AssetHandler) Upload(c *gin.Context) {
	memberID, ok := parseID(c, "id")
	if !ok {
		return
	}
	scope := normalizeAssetScope(c.PostForm("assetScope"))
	if scope == "" {
		scope = "profile"
	}
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		httpx.Abort(c, http.StatusBadRequest, "file_required", "请选择要上传的文件")
		return
	}
	defer file.Close()
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = mime.TypeByExtension(filepath.Ext(header.Filename))
	}
	if !supportedAsset(scope, mimeType) {
		if scope == "ritual" {
			httpx.Abort(c, http.StatusBadRequest, "unsupported_file", "只支持上传图片或视频文件")
		} else {
			httpx.Abort(c, http.StatusBadRequest, "unsupported_file", "只支持上传图片文件")
		}
		return
	}
	if strings.HasPrefix(mimeType, "video/") && header.Size > 80*1024*1024 {
		httpx.Abort(c, http.StatusBadRequest, "file_too_large", "视频大小不能超过 80 MB")
		return
	}
	if strings.HasPrefix(mimeType, "image/") && header.Size > 10*1024*1024 {
		httpx.Abort(c, http.StatusBadRequest, "file_too_large", "图片大小不能超过 10 MB")
		return
	}
	objectPath := filepath.ToSlash(filepath.Join("members", strconvInt(memberID), scope, randomName(header.Filename)))
	fullPath := filepath.Join(h.cfg.StorageRoot, memberAssetBucket, filepath.FromSlash(objectPath))
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "upload_failed", "上传附件失败")
		return
	}
	out, err := os.Create(fullPath)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "upload_failed", "上传附件失败")
		return
	}
	_, copyErr := io.Copy(out, file)
	closeErr := out.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(fullPath)
		httpx.Abort(c, http.StatusInternalServerError, "upload_failed", "上传附件失败")
		return
	}
	account, _ := middleware.Current(c)
	asset, err := h.repo.CreateAsset(c.Request.Context(), model.MemberAsset{MemberID: memberID, Bucket: memberAssetBucket, AssetScope: scope, ObjectPath: objectPath, FileName: header.Filename, MimeType: mimeType, FileSize: header.Size, UploadedBy: account.UserID})
	if err != nil {
		_ = os.Remove(fullPath)
		httpx.Abort(c, http.StatusInternalServerError, "upload_failed", "上传附件失败")
		return
	}
	h.hub.Publish(`{"member_assets_changed":true}`)
	c.JSON(http.StatusOK, gin.H{"asset": asset})
}

func (h *AssetHandler) ArchiveImport(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		httpx.Abort(c, http.StatusBadRequest, "file_required", "缺少导入文件")
		return
	}
	defer file.Close()
	if !isImportArchiveFile(header.Filename) {
		httpx.Abort(c, http.StatusBadRequest, "unsupported_file", "只支持归档 Excel 或 CSV 导入文件")
		return
	}
	if header.Size > 25*1024*1024 {
		httpx.Abort(c, http.StatusBadRequest, "file_too_large", "导入文件大小不能超过 25 MB")
		return
	}
	datePath := time.Now().Format("2006-01-02")
	objectPath := filepath.ToSlash(filepath.Join("imports", datePath, randomName(header.Filename)))
	fullPath := filepath.Join(h.cfg.StorageRoot, importArchiveBucket, filepath.FromSlash(objectPath))
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "archive_failed", "归档导入文件失败")
		return
	}
	out, err := os.Create(fullPath)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "archive_failed", "归档导入文件失败")
		return
	}
	_, copyErr := io.Copy(out, file)
	closeErr := out.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(fullPath)
		httpx.Abort(c, http.StatusInternalServerError, "archive_failed", "归档导入文件失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"path": objectPath})
}

func (h *AssetHandler) Download(c *gin.Context) {
	asset, ok := h.getAsset(c)
	if !ok {
		return
	}
	fullPath := filepath.Join(h.cfg.StorageRoot, asset.Bucket, filepath.FromSlash(asset.ObjectPath))
	if _, err := os.Stat(fullPath); err != nil {
		httpx.Abort(c, http.StatusNotFound, "asset_file_not_found", "附件文件不存在")
		return
	}
	c.Header("Content-Disposition", "inline; filename=\""+asset.FileName+"\"")
	c.File(fullPath)
}

func (h *AssetHandler) Delete(c *gin.Context) {
	asset, err := h.repo.DeleteAsset(c.Request.Context(), c.Param("assetId"))
	if errors.Is(err, repo.ErrNotFound) {
		httpx.Abort(c, http.StatusNotFound, "asset_not_found", "附件不存在")
		return
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "delete_failed", "删除附件失败")
		return
	}
	_ = os.Remove(filepath.Join(h.cfg.StorageRoot, asset.Bucket, filepath.FromSlash(asset.ObjectPath)))
	h.hub.Publish(`{"member_assets_changed":true}`)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *AssetHandler) getAsset(c *gin.Context) (*model.MemberAsset, bool) {
	asset, err := h.repo.GetAsset(c.Request.Context(), c.Param("assetId"))
	if errors.Is(err, repo.ErrNotFound) {
		httpx.Abort(c, http.StatusNotFound, "asset_not_found", "附件不存在")
		return nil, false
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "asset_failed", "读取附件失败")
		return nil, false
	}
	return asset, true
}

func normalizeAssetScope(scope string) string {
	if scope == "profile" || scope == "ritual" {
		return scope
	}
	return ""
}

func supportedAsset(scope string, mimeType string) bool {
	if strings.HasPrefix(mimeType, "image/") {
		return true
	}
	return scope == "ritual" && (mimeType == "video/mp4" || mimeType == "video/webm" || mimeType == "video/quicktime")
}

func isImportArchiveFile(fileName string) bool {
	extension := strings.ToLower(filepath.Ext(fileName))
	return extension == ".xlsx" || extension == ".xls" || extension == ".csv"
}

func randomName(fileName string) string {
	safe := strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '_' || r == '-' {
			return r
		}
		return '-'
	}, strings.TrimSpace(fileName))
	if safe == "" {
		safe = "asset"
	}
	return strconv.FormatInt(time.Now().UnixNano(), 10) + "-" + safe
}

func strconvInt(value int64) string { return strconv.FormatInt(value, 10) }
