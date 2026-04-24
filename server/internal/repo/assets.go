package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"zupu/server/internal/model"
)

func (r *Repository) CreateAsset(ctx context.Context, input model.MemberAsset) (*model.MemberAsset, error) {
	row := r.pool.QueryRow(ctx, `insert into member_assets(member_id,bucket,asset_scope,object_path,file_name,mime_type,file_size,uploaded_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,member_id,bucket,asset_scope,object_path,file_name,mime_type,file_size,uploaded_by,created_at`, input.MemberID, input.Bucket, input.AssetScope, input.ObjectPath, input.FileName, input.MimeType, input.FileSize, input.UploadedBy)
	return scanAsset(row)
}

func (r *Repository) ListAssets(ctx context.Context, memberID int64, scope string) ([]model.MemberAsset, error) {
	args := []any{memberID}
	where := ` where member_id=$1`
	if scope != "" {
		args = append(args, scope)
		where += ` and asset_scope=$2`
	}
	rows, err := r.pool.Query(ctx, `select id,member_id,bucket,asset_scope,object_path,file_name,mime_type,file_size,uploaded_by,created_at from member_assets`+where+` order by created_at desc`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []model.MemberAsset{}
	for rows.Next() {
		item, err := scanAsset(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetAsset(ctx context.Context, id string) (*model.MemberAsset, error) {
	item, err := scanAsset(r.pool.QueryRow(ctx, `select id,member_id,bucket,asset_scope,object_path,file_name,mime_type,file_size,uploaded_by,created_at from member_assets where id=$1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return item, err
}

func (r *Repository) DeleteAsset(ctx context.Context, id string) (*model.MemberAsset, error) {
	item, err := scanAsset(r.pool.QueryRow(ctx, `delete from member_assets where id=$1 returning id,member_id,bucket,asset_scope,object_path,file_name,mime_type,file_size,uploaded_by,created_at`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return item, err
}

func scanAsset(row scanner) (*model.MemberAsset, error) {
	var item model.MemberAsset
	err := row.Scan(&item.ID, &item.MemberID, &item.Bucket, &item.AssetScope, &item.ObjectPath, &item.FileName, &item.MimeType, &item.FileSize, &item.UploadedBy, &item.CreatedAt)
	return &item, err
}
