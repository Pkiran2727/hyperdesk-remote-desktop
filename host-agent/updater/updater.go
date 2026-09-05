package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type ReleaseManifest struct {
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl"`
	SHA256      string `json:"sha256"`
	ReleaseDate string `json:"releaseDate"`
}

type SilentUpdater struct {
	CurrentVersion string
	ManifestURL    string
}

func NewSilentUpdater(currentVersion string, manifestURL string) *SilentUpdater {
	return &SilentUpdater{
		CurrentVersion: currentVersion,
		ManifestURL:    manifestURL,
	}
}

func (u *SilentUpdater) CheckAndApplyUpdate() (*ReleaseManifest, bool, error) {
	fmt.Printf("[SilentUpdater] Checking for host agent updates (Current v%s)...\n", u.CurrentVersion)

	// Simulated manifest check
	manifest := &ReleaseManifest{
		Version:     "1.1.0",
		DownloadURL: "https://releases.hyperdesk.io/agent/hyperdesk-host-v1.1.0.bin",
		SHA256:      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		ReleaseDate: "2026-09-05",
	}

	if manifest.Version != u.CurrentVersion {
		fmt.Printf("[SilentUpdater] New update available: v%s. Verifying SHA-256 signature...\n", manifest.Version)
		return manifest, true, nil
	}

	return nil, false, nil
}

func VerifyFileSha256(filePath string, expectedHash string) (bool, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return false, err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return false, err
	}

	calculatedHash := hex.EncodeToString(hasher.Sum(nil))
	return calculatedHash == expectedHash, nil
}
