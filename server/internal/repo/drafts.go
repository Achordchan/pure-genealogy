package repo

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"zupu/server/internal/model"
)

func (r *Repository) UpsertMemberDraft(ctx context.Context, profileID string, memberID int64, payload map[string]interface{}) (*model.MemberChangeRequest, error) {
	bytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	row := r.pool.QueryRow(ctx, `with existing as (
		select id from member_change_requests where account_profile_id=$1 and status='pending' order by updated_at desc limit 1
	), updated as (
		update member_change_requests set member_id=$2,payload=$3,updated_at=now() where id in (select id from existing) returning id,account_profile_id,member_id,payload,status,review_comment,reviewed_by,reviewed_at,created_at,updated_at
	)
	insert into member_change_requests(account_profile_id,member_id,payload)
	select $1,$2,$3 where not exists(select 1 from updated)
	returning id,account_profile_id,member_id,payload,status,review_comment,reviewed_by,reviewed_at,created_at,updated_at`, profileID, memberID, bytes)
	item, err := scanDraft(row)
	if errors.Is(err, pgx.ErrNoRows) {
		row = r.pool.QueryRow(ctx, `select id,account_profile_id,member_id,payload,status,review_comment,reviewed_by,reviewed_at,created_at,updated_at from member_change_requests where account_profile_id=$1 and status='pending' order by updated_at desc limit 1`, profileID)
		return scanDraft(row)
	}
	return item, err
}

func (r *Repository) ListMyDrafts(ctx context.Context, profileID string) ([]model.MemberChangeRequest, error) {
	rows, err := r.pool.Query(ctx, `select id,account_profile_id,member_id,payload,status,review_comment,reviewed_by,reviewed_at,created_at,updated_at from member_change_requests where account_profile_id=$1 order by created_at desc`, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDrafts(rows)
}

func (r *Repository) WithdrawDraft(ctx context.Context, profileID string, requestID string) error {
	command, err := r.pool.Exec(ctx, `delete from member_change_requests where id=$1 and account_profile_id=$2 and status='pending'`, requestID, profileID)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) ListPendingDrafts(ctx context.Context) ([]model.MemberChangeReview, error) {
	rows, err := r.pool.Query(ctx, `select r.id,r.account_profile_id,r.member_id,r.payload,r.status,r.review_comment,r.reviewed_by,r.reviewed_at,r.created_at,r.updated_at,
		ap.id,ap.user_id,ap.legacy_auth_user_id,ap.real_name,ap.real_name_normalized,ap.id_card_value,ap.id_card_hash,ap.id_card_masked,ap.phone,ap.status,ap.role,ap.member_id,ap.approved_at,ap.approved_by,ap.created_at,ap.updated_at,
		m.id,m.name,m.generation,m.sibling_order,m.father_id,f.name,m.gender,m.official_position,m.is_alive,m.spouse,m.remarks,m.birthday,m.death_date,m.residence_place,m.created_at,m.updated_at
		from member_change_requests r join account_profiles ap on ap.id=r.account_profile_id join family_members m on m.id=r.member_id left join family_members f on f.id=m.father_id where r.status='pending' order by r.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []model.MemberChangeReview{}
	for rows.Next() {
		var item model.MemberChangeReview
		request, err := scanDraftPrefix(rows, &item.Account, &item.Member)
		if err != nil {
			return nil, err
		}
		item.Request = *request
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) ReviewDraft(ctx context.Context, requestID string, status string, reviewerUserID string, comment string) (*model.MemberChangeRequest, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	request, err := scanDraft(tx.QueryRow(ctx, `select id,account_profile_id,member_id,payload,status,review_comment,reviewed_by,reviewed_at,created_at,updated_at from member_change_requests where id=$1 and status='pending' for update`, requestID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status == "approved" {
		if err := applyDraftPayload(ctx, tx, request.MemberID, request.Payload); err != nil {
			return nil, err
		}
	}
	updated, err := scanDraft(tx.QueryRow(ctx, `update member_change_requests set status=$2,review_comment=nullif($3,''),reviewed_by=$4,reviewed_at=now(),updated_at=now() where id=$1 returning id,account_profile_id,member_id,payload,status,review_comment,reviewed_by,reviewed_at,created_at,updated_at`, requestID, status, comment, reviewerUserID))
	if err != nil {
		return nil, err
	}
	return updated, tx.Commit(ctx)
}

func applyDraftPayload(ctx context.Context, tx pgx.Tx, memberID int64, payload map[string]interface{}) error {
	_, err := tx.Exec(ctx, `update family_members set spouse=coalesce($2,spouse),birthday=$3,gender=coalesce($4,gender),is_alive=coalesce($5,is_alive),death_date=$6,residence_place=coalesce($7,residence_place),official_position=coalesce($8,official_position),remarks=coalesce($9,remarks),updated_at=now() where id=$1`, memberID, payload["spouse"], payload["birthday"], payload["gender"], payload["is_alive"], payload["death_date"], payload["residence_place"], payload["official_position"], payload["remarks"])
	return err
}

func scanDraft(row scanner) (*model.MemberChangeRequest, error) {
	var item model.MemberChangeRequest
	var payload []byte
	err := row.Scan(&item.ID, &item.AccountProfileID, &item.MemberID, &payload, &item.Status, &item.ReviewComment, &item.ReviewedBy, &item.ReviewedAt, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(payload, &item.Payload); err != nil {
		return nil, err
	}
	return &item, nil
}

func scanDrafts(rows pgx.Rows) ([]model.MemberChangeRequest, error) {
	items := []model.MemberChangeRequest{}
	for rows.Next() {
		item, err := scanDraft(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func scanDraftPrefix(row scanner, profile *model.AccountProfile, member *model.FamilyMember) (*model.MemberChangeRequest, error) {
	var request model.MemberChangeRequest
	var payload []byte
	err := row.Scan(&request.ID, &request.AccountProfileID, &request.MemberID, &payload, &request.Status, &request.ReviewComment, &request.ReviewedBy, &request.ReviewedAt, &request.CreatedAt, &request.UpdatedAt, &profile.ID, &profile.UserID, &profile.LegacyAuthUserID, &profile.RealName, &profile.RealNameNormalized, &profile.IDCardValue, &profile.IDCardHash, &profile.IDCardMasked, &profile.Phone, &profile.Status, &profile.Role, &profile.MemberID, &profile.ApprovedAt, &profile.ApprovedBy, &profile.CreatedAt, &profile.UpdatedAt, &member.ID, &member.Name, &member.Generation, &member.SiblingOrder, &member.FatherID, &member.FatherName, &member.Gender, &member.OfficialPosition, &member.IsAlive, &member.Spouse, &member.Remarks, &member.Birthday, &member.DeathDate, &member.ResidencePlace, &member.CreatedAt, &member.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(payload, &request.Payload); err != nil {
		return nil, err
	}
	return &request, nil
}
