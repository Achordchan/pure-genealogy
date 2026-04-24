package auth

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func EnsureInitialAdmin(ctx context.Context, pool *pgxpool.Pool, realName string, idCard string, salt string) error {
	name := NormalizeRealName(realName)
	card := NormalizeIDCard(idCard)
	passwordHash, err := HashPassword(card)
	if err != nil {
		return err
	}
	idHash := HashIDCard(card, salt)
	masked := MaskIDCard(card)
	username := "acct_" + idHash[:16]
	_, err = pool.Exec(ctx, `with user_row as (
		insert into app_users(username,password_hash,real_name,status,role)
		values($1,$2,$3,'active','admin')
		on conflict(username) do update set password_hash=excluded.password_hash, real_name=excluded.real_name, role='admin', status='active', updated_at=now()
		returning id
	)
	insert into account_profiles(user_id,real_name,real_name_normalized,id_card_value,id_card_hash,id_card_masked,status,role,approved_at)
	select id,$3,$4,$5,$6,$7,'approved','admin',now() from user_row
	on conflict(id_card_hash) do update set status='approved', role='admin', updated_at=now()`, username, passwordHash, strings.TrimSpace(realName), name, card, idHash, masked)
	return err
}
