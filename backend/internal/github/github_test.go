package github

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	enc, err := Encrypt(key, "hello")
	if err != nil {
		t.Fatal(err)
	}
	plain, err := Decrypt(key, enc)
	if err != nil {
		t.Fatal(err)
	}
	if plain != "hello" {
		t.Errorf("want hello, got %q", plain)
	}
}

func TestVerifySignature(t *testing.T) {
	secret := "test"
	body := []byte(`{"action":"push"}`)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	good := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	if !VerifySignature(secret, good, body) {
		t.Error("valid sig rejected")
	}
	if VerifySignature(secret, "sha256=00", body) {
		t.Error("invalid sig accepted")
	}
	if VerifySignature(secret, "wrong", body) {
		t.Error("malformed header accepted")
	}
}
