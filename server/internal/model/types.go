package model

import "time"

type PageResult[T any] struct {
	Data  []T   `json:"data"`
	Count int64 `json:"count"`
}

type AccountProfile struct {
	ID                 string     `json:"id"`
	UserID             string     `json:"user_id"`
	LegacyAuthUserID   *string    `json:"auth_user_id,omitempty"`
	RealName           string     `json:"real_name"`
	RealNameNormalized string     `json:"real_name_normalized"`
	IDCardValue        *string    `json:"id_card_value"`
	IDCardHash         string     `json:"id_card_hash"`
	IDCardMasked       string     `json:"id_card_masked"`
	Phone              *string    `json:"phone"`
	Status             string     `json:"status"`
	Role               string     `json:"role"`
	MemberID           *int64     `json:"member_id"`
	ApprovedAt         *time.Time `json:"approved_at"`
	ApprovedBy         *string    `json:"approved_by"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type CurrentAccount struct {
	UserID  string         `json:"user_id"`
	Profile AccountProfile `json:"profile"`
}

type FamilyMember struct {
	ID               int64      `json:"id"`
	Name             string     `json:"name"`
	Generation       *int       `json:"generation"`
	SiblingOrder     *int       `json:"sibling_order"`
	FatherID         *int64     `json:"father_id"`
	FatherName       *string    `json:"father_name,omitempty"`
	Gender           *string    `json:"gender"`
	OfficialPosition *string    `json:"official_position"`
	IsAlive          bool       `json:"is_alive"`
	Spouse           *string    `json:"spouse"`
	Remarks          *string    `json:"remarks"`
	Birthday         *time.Time `json:"birthday"`
	DeathDate        *time.Time `json:"death_date"`
	ResidencePlace   *string    `json:"residence_place"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type MemberRitual struct {
	ID           string    `json:"id"`
	MemberID     int64     `json:"member_id"`
	CemeteryName string    `json:"cemetery_name"`
	AreaBlock    *string   `json:"area_block"`
	PlotNumber   *string   `json:"plot_number"`
	Address      string    `json:"address"`
	Province     *string   `json:"province"`
	City         *string   `json:"city"`
	District     *string   `json:"district"`
	Latitude     *float64  `json:"latitude"`
	Longitude    *float64  `json:"longitude"`
	ContactName  *string   `json:"contact_name"`
	ContactPhone *string   `json:"contact_phone"`
	GuideText    *string   `json:"guide_text"`
	RitualNotes  *string   `json:"ritual_notes"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type RitualSearchItem struct {
	MemberID   int64         `json:"member_id"`
	Name       string        `json:"name"`
	Generation *int          `json:"generation"`
	FatherName *string       `json:"father_name"`
	Spouse     *string       `json:"spouse"`
	DeathDate  *time.Time    `json:"death_date"`
	Ritual     *MemberRitual `json:"ritual"`
}

type RitualDetail struct {
	RitualSearchItem
	Birthday         *time.Time `json:"birthday"`
	ResidencePlace   *string    `json:"residence_place"`
	OfficialPosition *string    `json:"official_position"`
	Remarks          *string    `json:"remarks"`
}

type MemberAsset struct {
	ID         string    `json:"id"`
	MemberID   int64     `json:"member_id"`
	Bucket     string    `json:"bucket"`
	AssetScope string    `json:"asset_scope"`
	ObjectPath string    `json:"object_path"`
	FileName   string    `json:"file_name"`
	MimeType   string    `json:"mime_type"`
	FileSize   int64     `json:"file_size"`
	UploadedBy string    `json:"uploaded_by"`
	CreatedAt  time.Time `json:"created_at"`
}

type MemberChangeRequest struct {
	ID               string                 `json:"id"`
	AccountProfileID string                 `json:"account_profile_id"`
	MemberID         int64                  `json:"member_id"`
	Payload          map[string]interface{} `json:"payload"`
	Status           string                 `json:"status"`
	ReviewComment    *string                `json:"review_comment"`
	ReviewedBy       *string                `json:"reviewed_by"`
	ReviewedAt       *time.Time             `json:"reviewed_at"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
}

type MemberChangeReview struct {
	Request MemberChangeRequest `json:"request"`
	Account AccountProfile      `json:"account"`
	Member  FamilyMember        `json:"member"`
}
