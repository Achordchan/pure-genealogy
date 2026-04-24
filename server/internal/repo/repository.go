package repo

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"zupu/server/internal/model"
)

var ErrNotFound = errors.New("not found")

type Repository struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func (r *Repository) Pool() *pgxpool.Pool { return r.pool }

func (r *Repository) ProfileByIDHash(ctx context.Context, hash string) (*model.AccountProfile, string, error) {
	row := r.pool.QueryRow(ctx, `select ap.id, ap.user_id, ap.legacy_auth_user_id, ap.real_name, ap.real_name_normalized, ap.id_card_value, ap.id_card_hash, ap.id_card_masked, ap.phone, ap.status, ap.role, ap.member_id, ap.approved_at, ap.approved_by, ap.created_at, ap.updated_at, au.password_hash from account_profiles ap join app_users au on au.id = ap.user_id where ap.id_card_hash=$1`, hash)
	profile, passwordHash, err := scanProfileWithPassword(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", ErrNotFound
	}
	return profile, passwordHash, err
}

func (r *Repository) ProfileBySession(ctx context.Context, tokenHash string) (*model.CurrentAccount, error) {
	row := r.pool.QueryRow(ctx, `select ap.id, ap.user_id, ap.legacy_auth_user_id, ap.real_name, ap.real_name_normalized, ap.id_card_value, ap.id_card_hash, ap.id_card_masked, ap.phone, ap.status, ap.role, ap.member_id, ap.approved_at, ap.approved_by, ap.created_at, ap.updated_at from sessions s join account_profiles ap on ap.user_id=s.user_id where s.token_hash=$1 and s.revoked_at is null and s.expires_at > now()`, tokenHash)
	profile, err := scanProfile(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &model.CurrentAccount{UserID: profile.UserID, Profile: *profile}, nil
}

func (r *Repository) CreateSession(ctx context.Context, userID string, tokenHash string, userAgent string, ip string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `insert into sessions(user_id, token_hash, user_agent, ip_address, expires_at) values($1,$2,$3,nullif($4,'')::inet,$5)`, userID, tokenHash, userAgent, ip, expiresAt)
	return err
}

func (r *Repository) RevokeSession(ctx context.Context, tokenHash string) error {
	_, err := r.pool.Exec(ctx, `update sessions set revoked_at=now() where token_hash=$1 and revoked_at is null`, tokenHash)
	return err
}

func (r *Repository) BackofficeCounts(ctx context.Context) (map[string]int64, error) {
	var pendingAccounts int64
	var pendingMemberChanges int64
	if err := r.pool.QueryRow(ctx, `select count(*) from account_profiles where status='pending'`).Scan(&pendingAccounts); err != nil {
		return nil, err
	}
	if err := r.pool.QueryRow(ctx, `select count(*) from member_change_requests where status='pending'`).Scan(&pendingMemberChanges); err != nil {
		return nil, err
	}
	return map[string]int64{
		"pending_accounts":       pendingAccounts,
		"pending_member_changes": pendingMemberChanges,
		"total":                  pendingAccounts + pendingMemberChanges,
	}, nil
}

func (r *Repository) ListMembers(ctx context.Context) ([]model.FamilyMember, error) {
	rows, err := r.pool.Query(ctx, `select m.id,m.name,m.generation,m.sibling_order,m.father_id,f.name,m.gender,m.official_position,m.is_alive,m.spouse,m.remarks,m.birthday,m.death_date,m.residence_place,m.created_at,m.updated_at from family_members m left join family_members f on f.id=m.father_id order by m.generation nulls last, m.sibling_order nulls last, m.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []model.FamilyMember{}
	for rows.Next() {
		var item model.FamilyMember
		if err := rows.Scan(&item.ID, &item.Name, &item.Generation, &item.SiblingOrder, &item.FatherID, &item.FatherName, &item.Gender, &item.OfficialPosition, &item.IsAlive, &item.Spouse, &item.Remarks, &item.Birthday, &item.DeathDate, &item.ResidencePlace, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) GetMember(ctx context.Context, id int64) (*model.FamilyMember, error) {
	row := r.pool.QueryRow(ctx, `select m.id,m.name,m.generation,m.sibling_order,m.father_id,f.name,m.gender,m.official_position,m.is_alive,m.spouse,m.remarks,m.birthday,m.death_date,m.residence_place,m.created_at,m.updated_at from family_members m left join family_members f on f.id=m.father_id where m.id=$1`, id)
	var item model.FamilyMember
	err := row.Scan(&item.ID, &item.Name, &item.Generation, &item.SiblingOrder, &item.FatherID, &item.FatherName, &item.Gender, &item.OfficialPosition, &item.IsAlive, &item.Spouse, &item.Remarks, &item.Birthday, &item.DeathDate, &item.ResidencePlace, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &item, err
}

func (r *Repository) ListRituals(ctx context.Context, keyword string, generation *int) ([]model.RitualSearchItem, []int, error) {
	members, err := r.ListMembers(ctx)
	if err != nil {
		return nil, nil, err
	}
	rituals, err := r.ritualMap(ctx)
	if err != nil {
		return nil, nil, err
	}
	gens := map[int]bool{}
	items := []model.RitualSearchItem{}
	needle := strings.ToLower(strings.TrimSpace(keyword))
	for _, member := range members {
		if member.IsAlive {
			continue
		}
		if member.Generation != nil {
			gens[*member.Generation] = true
		}
		if generation != nil && (member.Generation == nil || *member.Generation != *generation) {
			continue
		}
		ritual := rituals[member.ID]
		searchText := strings.ToLower(member.Name + " " + ptr(member.FatherName))
		if ritual != nil {
			searchText += " " + ritual.CemeteryName + " " + ritual.Address + " " + ptr(ritual.AreaBlock) + " " + ptr(ritual.PlotNumber)
		}
		if needle != "" && !strings.Contains(searchText, needle) {
			continue
		}
		items = append(items, model.RitualSearchItem{MemberID: member.ID, Name: member.Name, Generation: member.Generation, FatherName: member.FatherName, Spouse: member.Spouse, DeathDate: member.DeathDate, Ritual: ritual})
	}
	generations := make([]int, 0, len(gens))
	for gen := range gens {
		generations = append(generations, gen)
	}
	for i := range generations {
		for j := i + 1; j < len(generations); j++ {
			if generations[j] < generations[i] {
				generations[i], generations[j] = generations[j], generations[i]
			}
		}
	}
	return items, generations, nil
}

func (r *Repository) GetRitualDetail(ctx context.Context, memberID int64) (*model.RitualDetail, error) {
	member, err := r.GetMember(ctx, memberID)
	if err != nil {
		return nil, err
	}
	if member.IsAlive {
		return nil, ErrNotFound
	}
	ritual, err := r.GetRitual(ctx, memberID)
	if errors.Is(err, ErrNotFound) {
		ritual = nil
	} else if err != nil {
		return nil, err
	}
	return &model.RitualDetail{RitualSearchItem: model.RitualSearchItem{MemberID: member.ID, Name: member.Name, Generation: member.Generation, FatherName: member.FatherName, Spouse: member.Spouse, DeathDate: member.DeathDate, Ritual: ritual}, Birthday: member.Birthday, ResidencePlace: member.ResidencePlace, OfficialPosition: member.OfficialPosition, Remarks: member.Remarks}, nil
}

func (r *Repository) GetRitual(ctx context.Context, memberID int64) (*model.MemberRitual, error) {
	row := r.pool.QueryRow(ctx, `select id,member_id,cemetery_name,area_block,plot_number,address,province,city,district,latitude,longitude,contact_name,contact_phone,guide_text,ritual_notes,updated_at from member_rituals where member_id=$1`, memberID)
	item, err := scanRitual(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return item, err
}

func (r *Repository) UpsertRitual(ctx context.Context, input model.MemberRitual) error {
	_, err := r.pool.Exec(ctx, `insert into member_rituals(member_id,cemetery_name,area_block,plot_number,address,province,city,district,latitude,longitude,contact_name,contact_phone,guide_text,ritual_notes,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now()) on conflict(member_id) do update set cemetery_name=excluded.cemetery_name, area_block=excluded.area_block, plot_number=excluded.plot_number, address=excluded.address, province=excluded.province, city=excluded.city, district=excluded.district, latitude=excluded.latitude, longitude=excluded.longitude, contact_name=excluded.contact_name, contact_phone=excluded.contact_phone, guide_text=excluded.guide_text, ritual_notes=excluded.ritual_notes, updated_at=now()`, input.MemberID, input.CemeteryName, input.AreaBlock, input.PlotNumber, input.Address, input.Province, input.City, input.District, input.Latitude, input.Longitude, input.ContactName, input.ContactPhone, input.GuideText, input.RitualNotes)
	return err
}

func (r *Repository) DeleteRitual(ctx context.Context, memberID int64) error {
	_, err := r.pool.Exec(ctx, `delete from member_rituals where member_id=$1`, memberID)
	return err
}

func (r *Repository) ritualMap(ctx context.Context) (map[int64]*model.MemberRitual, error) {
	rows, err := r.pool.Query(ctx, `select id,member_id,cemetery_name,area_block,plot_number,address,province,city,district,latitude,longitude,contact_name,contact_phone,guide_text,ritual_notes,updated_at from member_rituals`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := map[int64]*model.MemberRitual{}
	for rows.Next() {
		item, err := scanRitual(rows)
		if err != nil {
			return nil, err
		}
		items[item.MemberID] = item
	}
	return items, rows.Err()
}

func ptr(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

type scanner interface{ Scan(dest ...any) error }

func scanProfile(row scanner) (*model.AccountProfile, error) {
	var item model.AccountProfile
	err := row.Scan(&item.ID, &item.UserID, &item.LegacyAuthUserID, &item.RealName, &item.RealNameNormalized, &item.IDCardValue, &item.IDCardHash, &item.IDCardMasked, &item.Phone, &item.Status, &item.Role, &item.MemberID, &item.ApprovedAt, &item.ApprovedBy, &item.CreatedAt, &item.UpdatedAt)
	return &item, err
}

func scanProfileWithPassword(row scanner) (*model.AccountProfile, string, error) {
	var item model.AccountProfile
	var passwordHash string
	err := row.Scan(&item.ID, &item.UserID, &item.LegacyAuthUserID, &item.RealName, &item.RealNameNormalized, &item.IDCardValue, &item.IDCardHash, &item.IDCardMasked, &item.Phone, &item.Status, &item.Role, &item.MemberID, &item.ApprovedAt, &item.ApprovedBy, &item.CreatedAt, &item.UpdatedAt, &passwordHash)
	return &item, passwordHash, err
}

func scanRitual(row scanner) (*model.MemberRitual, error) {
	var item model.MemberRitual
	err := row.Scan(&item.ID, &item.MemberID, &item.CemeteryName, &item.AreaBlock, &item.PlotNumber, &item.Address, &item.Province, &item.City, &item.District, &item.Latitude, &item.Longitude, &item.ContactName, &item.ContactPhone, &item.GuideText, &item.RitualNotes, &item.UpdatedAt)
	return &item, err
}

func CheckMemberIsDead(ctx context.Context, tx pgx.Tx, memberID int64) error {
	var isAlive bool
	err := tx.QueryRow(ctx, `select is_alive from family_members where id=$1`, memberID).Scan(&isAlive)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if isAlive {
		return fmt.Errorf("在世成员不能保存祭祀资料")
	}
	return nil
}
