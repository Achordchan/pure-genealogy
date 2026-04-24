package repo

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"zupu/server/internal/model"
)

type MemberListParams struct {
	Page        int
	PageSize    int
	SearchQuery string
}

func (r *Repository) ListMembersPaged(ctx context.Context, params MemberListParams) (model.PageResult[model.FamilyMember], error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.PageSize <= 0 || params.PageSize > 200 {
		params.PageSize = 50
	}
	keyword := strings.TrimSpace(params.SearchQuery)
	args := []any{}
	where := ""
	if keyword != "" {
		args = append(args, "%"+keyword+"%")
		where = " where m.name ilike $1"
	}
	var count int64
	if err := r.pool.QueryRow(ctx, "select count(*) from family_members m"+where, args...).Scan(&count); err != nil {
		return model.PageResult[model.FamilyMember]{}, err
	}
	args = append(args, params.PageSize, (params.Page-1)*params.PageSize)
	rows, err := r.pool.Query(ctx, `select m.id,m.name,m.generation,m.sibling_order,m.father_id,f.name,m.gender,m.official_position,m.is_alive,m.spouse,m.remarks,m.birthday,m.death_date,m.residence_place,m.created_at,m.updated_at from family_members m left join family_members f on f.id=m.father_id`+where+` order by m.generation nulls last, m.sibling_order nulls last, m.id limit $`+itoa(len(args)-1)+` offset $`+itoa(len(args)), args...)
	if err != nil {
		return model.PageResult[model.FamilyMember]{}, err
	}
	defer rows.Close()
	items := []model.FamilyMember{}
	for rows.Next() {
		var item model.FamilyMember
		if err := rows.Scan(&item.ID, &item.Name, &item.Generation, &item.SiblingOrder, &item.FatherID, &item.FatherName, &item.Gender, &item.OfficialPosition, &item.IsAlive, &item.Spouse, &item.Remarks, &item.Birthday, &item.DeathDate, &item.ResidencePlace, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return model.PageResult[model.FamilyMember]{}, err
		}
		items = append(items, item)
	}
	return model.PageResult[model.FamilyMember]{Data: items, Count: count}, rows.Err()
}

func (r *Repository) CreateMember(ctx context.Context, input model.FamilyMember) (*model.FamilyMember, error) {
	row := r.pool.QueryRow(ctx, `insert into family_members(name,generation,sibling_order,father_id,gender,official_position,is_alive,spouse,remarks,birthday,death_date,residence_place,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()) returning id`, input.Name, input.Generation, input.SiblingOrder, input.FatherID, input.Gender, input.OfficialPosition, input.IsAlive, input.Spouse, input.Remarks, input.Birthday, input.DeathDate, input.ResidencePlace)
	var id int64
	if err := row.Scan(&id); err != nil {
		return nil, err
	}
	return r.GetMember(ctx, id)
}

func (r *Repository) UpdateMember(ctx context.Context, id int64, input model.FamilyMember) (*model.FamilyMember, error) {
	command, err := r.pool.Exec(ctx, `update family_members set name=$2,generation=$3,sibling_order=$4,father_id=$5,gender=$6,official_position=$7,is_alive=$8,spouse=$9,remarks=$10,birthday=$11,death_date=$12,residence_place=$13,updated_at=now() where id=$1`, id, input.Name, input.Generation, input.SiblingOrder, input.FatherID, input.Gender, input.OfficialPosition, input.IsAlive, input.Spouse, input.Remarks, input.Birthday, input.DeathDate, input.ResidencePlace)
	if err != nil {
		return nil, err
	}
	if command.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.GetMember(ctx, id)
}

func (r *Repository) DeleteMembers(ctx context.Context, ids []int64) ([]int64, error) {
	rows, err := r.pool.Query(ctx, `delete from family_members where id = any($1) returning id`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	deleted := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		deleted = append(deleted, id)
	}
	return deleted, rows.Err()
}

func (r *Repository) BatchCreateMembers(ctx context.Context, members []model.FamilyMember, fatherNames []string) (int, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	fatherMap := map[string]int64{}
	for _, name := range fatherNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var id int64
		err := tx.QueryRow(ctx, `select id from family_members where name=$1 order by generation nulls last, id desc limit 1`, name).Scan(&id)
		if err == nil {
			fatherMap[name] = id
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return 0, err
		}
	}
	for index, member := range members {
		if member.FatherID == nil && index < len(fatherNames) {
			if id, ok := fatherMap[strings.TrimSpace(fatherNames[index])]; ok {
				member.FatherID = &id
			}
		}
		_, err := tx.Exec(ctx, `insert into family_members(name,generation,sibling_order,father_id,gender,official_position,is_alive,spouse,remarks,birthday,death_date,residence_place,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`, member.Name, member.Generation, member.SiblingOrder, member.FatherID, member.Gender, member.OfficialPosition, member.IsAlive, member.Spouse, member.Remarks, member.Birthday, member.DeathDate, member.ResidencePlace)
		if err != nil {
			return 0, err
		}
	}
	return len(members), tx.Commit(ctx)
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := []byte{}
	for value > 0 {
		digits = append([]byte{byte('0' + value%10)}, digits...)
		value /= 10
	}
	return string(digits)
}
