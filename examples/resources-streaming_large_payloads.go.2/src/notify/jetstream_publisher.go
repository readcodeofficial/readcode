package notify

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nats-io/nats.go"
)

type JetStreamPublisher struct {
	js      nats.JetStreamContext
	subject string
}

func NewJetStreamPublisher(js nats.JetStreamContext, subject string) *JetStreamPublisher {
	return &JetStreamPublisher{js: js, subject: subject}
}

type outbound struct {
	CampaignID string  `json:"campaign_id"`
	Message    Message `json:"message"`
}

func (p *JetStreamPublisher) PublishBatch(ctx context.Context, campaignID string, msgs []Message) error {
	for i, m := range msgs {
		data, err := json.Marshal(outbound{CampaignID: campaignID, Message: m})
		if err != nil {
			return fmt.Errorf("marshal message %d: %w", i, err)
		}
		if _, err := p.js.Publish(p.subject, data, nats.Context(ctx)); err != nil {
			return fmt.Errorf("publish message %d: %w", i, err)
		}
	}
	return nil
}
