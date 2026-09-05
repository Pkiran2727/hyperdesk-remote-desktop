package models

import "time"

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Tier         string    `json:"tier"` // "free", "pro", "enterprise"
	StripeCustID string    `json:"stripeCustomerId"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Device struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	HostID    string    `json:"hostId"` // 9-digit HyperDesk ID
	AliasName string    `json:"aliasName"`
	OS        string    `json:"os"`
	IsOnline  bool      `json:"isOnline"`
	LastSeen  time.Time `json:"lastSeen"`
}

type SubscriptionPlan struct {
	Tier               string `json:"tier"`
	MonthlyPriceUSD    int    `json:"monthlyPriceUSD"`
	MaxDevices         int    `json:"maxDevices"`
	MaxConcurrentRecs  int    `json:"maxConcurrentRecs"`
	CustomRelayAllowed bool   `json:"customRelayAllowed"`
}
