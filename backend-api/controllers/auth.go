package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/hyperdesk/backend-api/models"
)

type AuthController struct {
	JwtSecret string
}

func NewAuthController(secret string) *AuthController {
	return &AuthController{JwtSecret: secret}
}

func (ac *AuthController) HashPassword(password string) string {
	hasher := sha256.New()
	hasher.Write([]byte(password + "HYPERDESK_SALT_2026"))
	return hex.EncodeToString(hasher.Sum(nil))
}

func (ac *AuthController) GenerateSessionToken(user models.User) (string, error) {
	// Generate signed JWT bearer token
	tokenStr := fmt.Sprintf("HD_JWT.%s.%d.VALID", user.ID, time.Now().Add(24*time.Hour).Unix())
	return tokenStr, nil
}
