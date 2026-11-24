module Webhooks
  class Publisher
    def self.publish(event)
      WebhookEndpoint.subscribed_to(event.type).find_each do |endpoint|
        delivery = WebhookDelivery.find_or_create_by!(
          webhook_endpoint_id: endpoint.id,
          event_id: event.id
        ) do |d|
          d.payload = event.to_webhook_payload
        end

        DeliverWebhookJob.perform_async(delivery.id) if delivery.previously_new_record?
      end
    end
  end
end

class PaymentEvent < ApplicationRecord
  after_commit :publish_webhooks, on: :create

  def to_webhook_payload
    {
      id: id,
      type: type,
      created: created_at.to_i,
      data: { payment_id: payment_id, amount: amount_cents, currency: currency }
    }
  end

  private

  def publish_webhooks
    Webhooks::Publisher.publish(self)
  end
end
