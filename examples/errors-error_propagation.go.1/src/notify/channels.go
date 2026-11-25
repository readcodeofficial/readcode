package notify

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type Message struct {
	ID      string
	UserID  string
	Subject string
	Body    string
}

type Channel interface {
	Name() string
	Send(ctx context.Context, msg Message) error
}

type EmailGateway interface {
	Deliver(ctx context.Context, address, subject, body string) error
}

type PushGateway interface {
	Push(ctx context.Context, deviceToken, title, body string) error
}

type Directory interface {
	Email(ctx context.Context, userID string) (string, error)
	DeviceToken(ctx context.Context, userID string) (string, error)
}

type EmailChannel struct {
	gw  EmailGateway
	dir Directory
}

func (c *EmailChannel) Name() string { return "email" }

func (c *EmailChannel) Send(ctx context.Context, msg Message) error {
	addr, err := c.dir.Email(ctx, msg.UserID)
	if err != nil {
		return fmt.Errorf("email lookup for %s: %w", msg.UserID, err)
	}
	if err := c.gw.Deliver(ctx, addr, msg.Subject, msg.Body); err != nil {
		return fmt.Errorf("email delivery for %s: %w", msg.UserID, err)
	}
	return nil
}

type PushChannel struct {
	gw  PushGateway
	dir Directory
}

func (c *PushChannel) Name() string { return "push" }

func (c *PushChannel) Send(ctx context.Context, msg Message) error {
	token, err := c.dir.DeviceToken(ctx, msg.UserID)
	if err != nil {
		return fmt.Errorf("push lookup for %s: %w", msg.UserID, err)
	}
	if err := c.gw.Push(ctx, token, msg.Subject, msg.Body); err != nil {
		return fmt.Errorf("push delivery for %s: %v", msg.UserID, err)
	}
	return nil
}

func classifyHTTP(provider string, status int) error {
	switch {
	case status < 300:
		return nil
	case status == http.StatusGone:
		return &ProviderError{Provider: provider, Status: status, Err: ErrUnsubscribed}
	case status == http.StatusTooManyRequests:
		return &ProviderError{Provider: provider, Status: status, Err: ErrRateLimited}
	default:
		return &ProviderError{Provider: provider, Status: status, Err: errors.New("unexpected response")}
	}
}

type HTTPPushGateway struct {
	Client  *http.Client
	BaseURL string
}

func (g *HTTPPushGateway) Push(ctx context.Context, deviceToken, title, body string) error {
	form := url.Values{"token": {deviceToken}, "title": {title}, "body": {body}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.BaseURL+"/v1/push", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := g.Client.Do(req)
	if err != nil {
		return fmt.Errorf("push gateway unreachable: %w", err)
	}
	defer resp.Body.Close()
	return classifyHTTP("push-gateway", resp.StatusCode)
}
