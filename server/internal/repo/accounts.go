package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"zupu/server/internal/model"
)

type NewAccountInput struct {
	Username           string
	PasswordHash       string
	RealName           string
	RealNameNormalized string
	IDCardValue        string
	IDCardHash         string
	IDCardMasked       string
	Role               string
	Status             string
}

func (r *Repository) CreateAccount(ctx context.Context, input NewAccountInput) (*model.AccountProfile, error) {
	row := r.pool.QueryRow(ctx, `with user_row as (
		insert into app_users(username,password_hash,real_name,status,role) values($1,$2,$3,'active',$4) returning id
	)
	insert into account_profiles(user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,status,role,approved_at)
	select id,$3,$5,$6,$7,$8,$9,$4,case when $9='approved' then now() else null end from user_row
	returning id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at`, input.Username, input.PasswordHash, input.RealName, input.Role, input.RealNameNormalized, input.IDCardValue, input.IDCardHash, input.IDCardMasked, input.Status)
	return scanProfile(row)
}

func (r *Repository) ProfileByHash(ctx context.Context, hash string) (*model.AccountProfile, error) {
	row := r.pool.QueryRow(ctx, `select id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at from account_profiles where id_card_hash=$1`, hash)
	profile, err := scanProfile(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return profile, err
}

func (r *Repository) ListPendingAccounts(ctx context.Context) ([]model.AccountProfile, error) {
	rows, err := r.pool.Query(ctx, `select id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at from account_profiles where status='pending' order by created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []model.AccountProfile{}
	for rows.Next() {
		item, err := scanProfile(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) ApproveAccount(ctx context.Context, profileID string, memberID int64, role string, reviewerUserID string) (*model.AccountProfile, error) {
	row := r.pool.QueryRow(ctx, `update account_profiles set status='approved', role=$2, member_id=$3, approved_at=now(), approved_by=$4, updated_at=now() where id=$1 and status='pending' returning id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at`, profileID, role, memberID, reviewerUserID)
	profile, err := scanProfile(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	_, err = r.pool.Exec(ctx, `update app_users set role=$2, updated_at=now() where id=$1`, profile.UserID, role)
	return profile, err
}

func (r *Repository) RejectAccount(ctx context.Context, profileID string, reviewerUserID string) (*model.AccountProfile, error) {
	row := r.pool.QueryRow(ctx, `update account_profiles set status='rejected', approved_at=null, approved_by=$2, updated_at=now() where id=$1 and status='pending' returning id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at`, profileID, reviewerUserID)
	profile, err := scanProfile(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return profile, err
}

func (r *Repository) UpdateProfilePhone(ctx context.Context, profileID string, phone string) error {
	command, err := r.pool.Exec(ctx, `update account_profiles set phone=$2, updated_at=now() where id=$1`, profileID, phone)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
