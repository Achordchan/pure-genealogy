package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"zupu/server/internal/auth"
	"zupu/server/internal/config"
	"zupu/server/internal/events"
	"zupu/server/internal/httpx"
	"zupu/server/internal/middleware"
	"zupu/server/internal/model"
	"zupu/server/internal/repo"
)

type MemberHandler struct {
	repo *repo.Repository
	cfg  config.Config
	hub  *events.Hub
}

func NewMemberHandler(repository *repo.Repository, cfg config.Config, hub *events.Hub) *MemberHandler {
	return &MemberHandler{repo: repository, cfg: cfg, hub: hub}
}

func (h *MemberHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))
	result, err := h.repo.ListMembersPaged(c.Request.Context(), repo.MemberListParams{Page: page, PageSize: pageSize, SearchQuery: c.Query("searchQuery")})
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "members_failed", "读取成员失败")
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *MemberHandler) All(c *gin.Context) {
	items, err := h.repo.ListMembers(c.Request.Context())
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "members_failed", "读取成员失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *MemberHandler) Get(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	item, err := h.repo.GetMember(c.Request.Context(), id)
	if err == repo.ErrNotFound {
		httpx.Abort(c, http.StatusNotFound, "member_not_found", "成员不存在")
		return
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "member_failed", "读取成员失败")
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *MemberHandler) Account(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	item, err := h.repo.AccountByMemberID(c.Request.Context(), id)
	if errors.Is(err, repo.ErrNotFound) {
		c.JSON(http.StatusOK, nil)
		return
	}
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "account_failed", "读取登录资料失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":            item.ID,
		"auth_user_id":  item.UserID,
		"role":          item.Role,
		"phone":         item.Phone,
		"id_card_value": item.IDCardValue,
		"status":        item.Status,
	})
}

func (h *MemberHandler) Create(c *gin.Context) {
	input, accountInput, ok := h.bindMember(c)
	if !ok {
		return
	}
	if accountInput != nil {
		current, _ := middleware.Current(c)
		if current.Profile.Role != "admin" {
			httpx.Abort(c, http.StatusForbidden, "forbidden", "当前账号无权维护登录资料")
			return
		}
	}
	account, removeAccount, err := h.buildAccountInput(input.Name, accountInput)
	if err != nil {
		httpx.Abort(c, http.StatusBadRequest, "account_invalid", err.Error())
		return
	}
	item, err := h.repo.CreateMemberWithAccount(c.Request.Context(), input, account, removeAccount)
	if err != nil {
		if isAccountConflict(err) {
			httpx.Abort(c, http.StatusConflict, "account_conflict", "该身份证号已绑定其他账号")
			return
		}
		httpx.Abort(c, http.StatusInternalServerError, "save_failed", "保存成员失败")
		return
	}
	h.hub.Publish(`{"family_members_changed":true}`)
	c.JSON(http.StatusOK, item)
}

func (h *MemberHandler) Update(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	input, accountInput, ok := h.bindMember(c)
	if !ok {
		return
	}
	if accountInput != nil {
		current, _ := middleware.Current(c)
		if current.Profile.Role != "admin" {
			httpx.Abort(c, http.StatusForbidden, "forbidden", "当前账号无权维护登录资料")
			return
		}
	}
	account, removeAccount, err := h.buildAccountInput(input.Name, accountInput)
	if err != nil {
		httpx.Abort(c, http.StatusBadRequest, "account_invalid", err.Error())
		return
	}
	item, err := h.repo.UpdateMemberWithAccount(c.Request.Context(), id, input, account, removeAccount)
	if err == repo.ErrNotFound {
		httpx.Abort(c, http.StatusNotFound, "member_not_found", "成员不存在")
		return
	}
	if err != nil {
		if isAccountConflict(err) {
			httpx.Abort(c, http.StatusConflict, "account_conflict", "该身份证号已绑定其他账号")
			return
		}
		httpx.Abort(c, http.StatusInternalServerError, "save_failed", "保存成员失败")
		return
	}
	h.hub.Publish(`{"family_members_changed":true}`)
	c.JSON(http.StatusOK, item)
}

type deleteMembersRequest struct {
	IDs []int64 `json:"ids"`
}

func (h *MemberHandler) Delete(c *gin.Context) {
	var input deleteMembersRequest
	if err := c.ShouldBindJSON(&input); err != nil || len(input.IDs) == 0 {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "没有选择要删除的成员")
		return
	}
	ids, err := h.repo.DeleteMembers(c.Request.Context(), input.IDs)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "delete_failed", "删除成员失败")
		return
	}
	h.hub.Publish(`{"family_members_changed":true}`)
	c.JSON(http.StatusOK, gin.H{"success": true, "deletedIds": ids})
}

type importMemberInput struct {
	Name             string  `json:"name"`
	Generation       *int    `json:"generation"`
	SiblingOrder     *int    `json:"sibling_order"`
	FatherName       *string `json:"father_name"`
	Gender           *string `json:"gender"`
	OfficialPosition *string `json:"official_position"`
	IsAlive          *bool   `json:"is_alive"`
	Spouse           *string `json:"spouse"`
	Remarks          *string `json:"remarks"`
	Birthday         *string `json:"birthday"`
	DeathDate        *string `json:"death_date"`
	ResidencePlace   *string `json:"residence_place"`
}

type batchImportRequest struct {
	Members []importMemberInput `json:"members"`
}

func (h *MemberHandler) BatchImport(c *gin.Context) {
	var input batchImportRequest
	if err := c.ShouldBindJSON(&input); err != nil || len(input.Members) == 0 {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "没有可导入的成员")
		return
	}
	members := make([]model.FamilyMember, 0, len(input.Members))
	fatherNames := make([]string, 0, len(input.Members))
	for _, item := range input.Members {
		member, ok := importToMember(c, item)
		if !ok {
			return
		}
		members = append(members, member)
		fatherNames = append(fatherNames, stringPtrValue(item.FatherName))
	}
	count, err := h.repo.BatchCreateMembers(c.Request.Context(), members, fatherNames)
	if err != nil {
		httpx.Abort(c, http.StatusInternalServerError, "import_failed", "批量导入成员失败")
		return
	}
	h.hub.Publish(`{"family_members_changed":true}`)
	c.JSON(http.StatusOK, gin.H{"success": true, "count": count})
}

type memberAccountInput struct {
	IDCard      *string `json:"idCard"`
	Phone       *string `json:"phone"`
	AccountRole *string `json:"accountRole"`
}

type memberSaveRequest struct {
	model.FamilyMember
	Account *memberAccountInput `json:"account"`
}

func (h *MemberHandler) bindMember(c *gin.Context) (model.FamilyMember, *memberAccountInput, bool) {
	var input memberSaveRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Abort(c, http.StatusBadRequest, "bad_request", "请填写成员信息")
		return model.FamilyMember{}, nil, false
	}
	input.FamilyMember.Name = strings.TrimSpace(input.FamilyMember.Name)
	if input.FamilyMember.Name == "" {
		httpx.Abort(c, http.StatusBadRequest, "name_required", "请填写成员姓名")
		return model.FamilyMember{}, nil, false
	}
	return input.FamilyMember, input.Account, true
}

func (h *MemberHandler) buildAccountInput(realName string, input *memberAccountInput) (*repo.MemberAccountSyncInput, bool, error) {
	if input == nil {
		return nil, false, nil
	}

	idCard := strings.TrimSpace(stringPtrValue(input.IDCard))
	if idCard == "" {
		return nil, true, nil
	}

	if message := auth.ValidateIdentity(realName, idCard); message != "" {
		return nil, false, errors.New(message)
	}

	phone := normalizePhone(input.Phone)
	if phone != nil && (len(*phone) != 11 || (*phone)[0] != '1') {
		return nil, false, errors.New("请输入正确的11位手机号")
	}

	role := "member"
	if strings.TrimSpace(stringPtrValue(input.AccountRole)) == "editor" {
		role = "editor"
	}

	card := auth.NormalizeIDCard(idCard)
	passwordHash, err := auth.HashPassword(card)
	if err != nil {
		return nil, false, err
	}

	idHash := auth.HashIDCard(card, h.cfg.IDHashSalt)
	return &repo.MemberAccountSyncInput{
		Username:           "acct_" + idHash[:16],
		PasswordHash:       passwordHash,
		RealName:           strings.TrimSpace(realName),
		RealNameNormalized: auth.NormalizeRealName(realName),
		IDCardValue:        card,
		IDCardHash:         idHash,
		IDCardMasked:       auth.MaskIDCard(card),
		Phone:              phone,
		Role:               role,
	}, false, nil
}

func isAccountConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func normalizePhone(value *string) *string {
	if value == nil {
		return nil
	}
	phone := strings.TrimSpace(*value)
	if phone == "" {
		return nil
	}
	return &phone
}

func importToMember(c *gin.Context, input importMemberInput) (model.FamilyMember, bool) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		httpx.Abort(c, http.StatusBadRequest, "name_required", "导入成员姓名不能为空")
		return model.FamilyMember{}, false
	}
	isAlive := true
	if input.IsAlive != nil {
		isAlive = *input.IsAlive
	}
	birthday, ok := parseDateField(c, input.Birthday, "birthday_invalid", "出生日期格式不正确")
	if !ok {
		return model.FamilyMember{}, false
	}
	deathDate, ok := parseDateField(c, input.DeathDate, "death_date_invalid", "逝世日期格式不正确")
	if !ok {
		return model.FamilyMember{}, false
	}
	return model.FamilyMember{Name: name, Generation: input.Generation, SiblingOrder: input.SiblingOrder, Gender: input.Gender, OfficialPosition: input.OfficialPosition, IsAlive: isAlive, Spouse: input.Spouse, Remarks: input.Remarks, Birthday: birthday, DeathDate: deathDate, ResidencePlace: input.ResidencePlace}, true
}

func parseDateField(c *gin.Context, value *string, code string, message string) (*time.Time, bool) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, true
	}
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(*value))
	if err != nil {
		httpx.Abort(c, http.StatusBadRequest, code, message)
		return nil, false
	}
	return &parsed, true
}

func parseID(c *gin.Context, key string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(key), 10, 64)
	if err != nil || id <= 0 {
		httpx.Abort(c, http.StatusBadRequest, "invalid_id", "参数不正确")
		return 0, false
	}
	return id, true
}

func stringPtrValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
