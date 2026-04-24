package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr        string
	DatabaseURL     string
	ShutdownTimeout time.Duration
	IDHashSalt      string
	SessionDays     int
	StorageRoot     string
	AllowedOrigins  []string
}

func Load() (Config, error) {
	loadDotEnv(".env")
	loadDotEnv(filepath.Join("server", ".env"))

	cfg := Config{
		HTTPAddr:        httpAddr(),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		ShutdownTimeout: 10 * time.Second,
		IDHashSalt:      os.Getenv("ACCOUNT_ID_HASH_SALT"),
		SessionDays:     30,
		StorageRoot:     env("STORAGE_ROOT", env("DATA_DIR", "./storage")),
		AllowedOrigins:  allowedOrigins(),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("缺少 DATABASE_URL 配置")
	}

	if cfg.IDHashSalt == "" {
		return Config{}, fmt.Errorf("缺少 ACCOUNT_ID_HASH_SALT 配置")
	}

	if value := os.Getenv("SHUTDOWN_TIMEOUT_SECONDS"); value != "" {
		seconds, err := strconv.Atoi(value)
		if err != nil || seconds <= 0 {
			return Config{}, fmt.Errorf("SHUTDOWN_TIMEOUT_SECONDS 必须是正整数")
		}
		cfg.ShutdownTimeout = time.Duration(seconds) * time.Second
	}

	if value := os.Getenv("SESSION_DAYS"); value != "" {
		days, err := strconv.Atoi(value)
		if err != nil || days <= 0 {
			return Config{}, fmt.Errorf("SESSION_DAYS 必须是正整数")
		}
		cfg.SessionDays = days
	}

	return cfg, nil
}

func loadDotEnv(path string) {
	content, err := os.ReadFile(path)
	if err != nil {
		return
	}

	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}

		key, value, _ := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key != "" && os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
}

func httpAddr() string {
	if value := os.Getenv("HTTP_ADDR"); value != "" {
		return value
	}

	if value := os.Getenv("PORT"); value != "" {
		return ":" + strings.TrimPrefix(value, ":")
	}

	return ":8080"
}

func allowedOrigins() []string {
	if value := os.Getenv("APP_ORIGINS"); value != "" {
		return splitCSV(value)
	}

	return splitCSV(os.Getenv("APP_ORIGIN"))
}

func env(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}
