package prefs

import (
	"errors"
	"strings"
)

// UpdateRequest is the body of PATCH /users/{id}/preferences. Fields the
// client leaves out must not change.
type UpdateRequest struct {
	DisplayName *string `json:"displayName"`
	EmailAlerts bool    `json:"emailAlerts"`
	DigestHour  *int    `json:"digestHour"`
}

func (r UpdateRequest) Validate() error {
	if r.DisplayName != nil && strings.TrimSpace(*r.DisplayName) == "" {
		return errors.New("displayName must not be blank")
	}
	if r.DigestHour != nil && (*r.DigestHour < 0 || *r.DigestHour > 23) {
		return errors.New("digestHour must be between 0 and 23")
	}
	return nil
}

// Apply returns current with the requested changes made.
func (r UpdateRequest) Apply(current Preferences) Preferences {
	if r.DisplayName != nil {
		current.DisplayName = strings.TrimSpace(*r.DisplayName)
	}
	current.EmailAlerts = r.EmailAlerts
	if r.DigestHour != nil {
		current.DigestHour = *r.DigestHour
	}
	return current
}
