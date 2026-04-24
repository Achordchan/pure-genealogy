package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

var idCardPattern = regexp.MustCompile(`^\d{17}[\dX]$`)

func NormalizeRealName(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), "")
}

func NormalizeIDCard(value string) string {
	return strings.ToUpper(strings.Join(strings.Fields(strings.TrimSpace(value)), ""))
}

func ValidateIdentity(realName string, idCard string) string {
	name := NormalizeRealName(realName)
	card := NormalizeIDCard(idCard)
	if len([]rune(name)) < 2 || len([]rune(name)) > 20 {
		return "姓名长度必须在 2 到 20 个字符之间"
	}
	if !idCardPattern.MatchString(card) {
		return "请输入正确的 18 位身份证号"
	}
	return ""
}

func MaskIDCard(value string) string {
	card := NormalizeIDCard(value)
	if len(card) < 10 {
		return card
	}
	return card[:6] + "********" + card[len(card)-4:]
}

func HashIDCard(value string, salt string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(salt) + ":" + NormalizeIDCard(value)))
	return hex.EncodeToString(sum[:])
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(hash string, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func NewToken() (string, string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token := hex.EncodeToString(raw)
	hash := sha256.Sum256([]byte(token))
	return token, hex.EncodeToString(hash[:]), nil
}

func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
