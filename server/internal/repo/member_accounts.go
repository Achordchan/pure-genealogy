package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"zupu/server/internal/model"
)

type MemberAccountSyncInput struct {
	Username           string
	PasswordHash       string
	RealName           string
	RealNameNormalized string
	IDCardValue        string
	IDCardHash         string
	IDCardMasked       string
	Phone              *string
	Role               string
}

func (r *Repository) AccountByMemberID(ctx context.Context, memberID int64) (*model.AccountProfile, error) {
	row := r.pool.QueryRow(ctx, `select id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at from account_profiles where member_id=$1`, memberID)
	profile, err := scanProfile(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return profile, err
}

func (r *Repository) CreateMemberWithAccount(ctx context.Context, input model.FamilyMember, account *MemberAccountSyncInput, removeAccount bool) (*model.FamilyMember, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var memberID int64
	if err := tx.QueryRow(ctx, `insert into family_members(name,generation,sibling_order,father_id,gender,official_position,is_alive,spouse,remarks,birthday,death_date,residence_place,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()) returning id`, input.Name, input.Generation, input.SiblingOrder, input.FatherID, input.Gender, input.OfficialPosition, input.IsAlive, input.Spouse, input.Remarks, input.Birthday, input.DeathDate, input.ResidencePlace).Scan(&memberID); err != nil {
		return nil, err
	}

	if err := syncMemberAccountTx(ctx, tx, memberID, account, removeAccount); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetMember(ctx, memberID)
}

func (r *Repository) UpdateMemberWithAccount(ctx context.Context, id int64, input model.FamilyMember, account *MemberAccountSyncInput, removeAccount bool) (*model.FamilyMember, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	command, err := tx.Exec(ctx, `update family_members set name=$2,generation=$3,sibling_order=$4,father_id=$5,gender=$6,official_position=$7,is_alive=$8,spouse=$9,remarks=$10,birthday=$11,death_date=$12,residence_place=$13,updated_at=now() where id=$1`, id, input.Name, input.Generation, input.SiblingOrder, input.FatherID, input.Gender, input.OfficialPosition, input.IsAlive, input.Spouse, input.Remarks, input.Birthday, input.DeathDate, input.ResidencePlace)
	if err != nil {
		return nil, err
	}
	if command.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	if err := syncMemberAccountTx(ctx, tx, id, account, removeAccount); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetMember(ctx, id)
}

func syncMemberAccountTx(ctx context.Context, tx pgx.Tx, memberID int64, account *MemberAccountSyncInput, removeAccount bool) error {
	profile, err := scanProfile(tx.QueryRow(ctx, `select id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at from account_profiles where member_id=$1 for update`, memberID))
	if errors.Is(err, pgx.ErrNoRows) {
		profile = nil
	} else if err != nil {
		return err
	}

	if removeAccount {
		if profile == nil {
			return nil
		}
		if profile.Role == "admin" {
			return errors.New("管理员账号不能在成员弹窗中清空")
		}
		_, err = tx.Exec(ctx, `delete from app_users where id=$1`, profile.UserID)
		return err
	}

	if account == nil {
		return nil
	}

	if profile == nil {
		_, err = scanProfile(tx.QueryRow(ctx, `with user_row as (
			insert into app_users(username,password_hash,real_name,status,role) values($1,$2,$3,'active',$4) returning id
		)
		insert into account_profiles(user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at)
		select id,$3,$5,$6,$7,$8,$9,'approved',$4,$10,now() from user_row
		returning id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at`, account.Username, account.PasswordHash, account.RealName, account.Role, account.RealNameNormalized, account.IDCardValue, account.IDCardHash, account.IDCardMasked, account.Phone, memberID))
		return err
	}

	if profile.Role == "admin" {
		return errors.New("管理员账号不能在成员弹窗中修改")
	}

	if _, err = tx.Exec(ctx, `update app_users set username=$2,password_hash=$3,real_name=$4,status='active',role=$5,updated_at=now() where id=$1`, profile.UserID, account.Username, account.PasswordHash, account.RealName, account.Role); err != nil {
		return err
	}

	_, err = scanProfile(tx.QueryRow(ctx, `update account_profiles set real_name=$2,real_name_normalized=$3,id_card_value=$4,id_card_hash=$5,id_card_masked=$6,phone=$7,status='approved',role=$8,member_id=$9,approved_at=coalesce(approved_at,now()),updated_at=now() where id=$1 returning id,user_id,legacy_auth_user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,phone,status,role,member_id,approved_at,approved_by,created_at,updated_at`, profile.ID, account.RealName, account.RealNameNormalized, account.IDCardValue, account.IDCardHash, account.IDCardMasked, account.Phone, account.Role, memberID))
	return err
}
