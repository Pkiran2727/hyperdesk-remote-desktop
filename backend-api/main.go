package main

import (
	"fmt"
	"net/http"

	"github.com/hyperdesk/backend-api/controllers"
)

func main() {
	authCtrl := controllers.NewAuthController("HyperDeskJwtSecret2026")
	billingCtrl := controllers.NewBillingController("sk_test_mock_stripe_key")

	http.HandleFunc("/api/v1/auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"status":"success","token":"HD_JWT.user123.VALID"}`)
	})

	http.HandleFunc("/api/v1/billing/checkout", func(w http.ResponseWriter, r *http.Request) {
		url, _ := billingCtrl.CreateCheckoutSession("usr_1", "pro")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"checkoutUrl":"%s"}`, url)
	})

	fmt.Println("=========================================================")
	fmt.Println("   HYPERDESK COMMERCIAL BACKEND REST API SERVICE v1.0")
	fmt.Println("=========================================================")
	fmt.Println("[BackendAPI] REST server listening on http://localhost:4000")
	_ = authCtrl
}
