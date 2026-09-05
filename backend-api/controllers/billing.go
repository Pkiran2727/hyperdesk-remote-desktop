package controllers

import (
	"fmt"
)

type BillingController struct {
	StripeSecretKey string
}

func NewBillingController(key string) *BillingController {
	return &BillingController{StripeSecretKey: key}
}

func (bc *BillingController) CreateCheckoutSession(userID string, planTier string) (string, error) {
	fmt.Printf("[Stripe Billing] Created checkout session for user %s on plan tier: %s\n", userID, planTier)
	checkoutURL := fmt.Sprintf("https://checkout.stripe.com/pay/cs_test_%s_%s", userID, planTier)
	return checkoutURL, nil
}

func (bc *BillingController) HandleStripeWebhook(eventType string, customerID string) string {
	if eventType == "checkout.session.completed" || eventType == "customer.subscription.created" {
		fmt.Printf("[Stripe Webhook] Upgraded subscription tier for customer: %s\n", customerID)
		return "pro"
	}
	return "free"
}
