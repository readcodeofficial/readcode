class DeliverWebhookJob
  include Sidekiq::Job

  sidekiq_options queue: :webhooks, retry: 8

  sidekiq_retry_in do |count, _exception|
    (2**count) * 30 + rand(0..30)
  end

  sidekiq_retries_exhausted do |msg, _exception|
    delivery = WebhookDelivery.find_by(id: msg["args"].first)
    delivery&.update!(status: "failed", last_error: "retries exhausted")
  end

  class RetryableError < StandardError; end

  OPEN_TIMEOUT = 3
  READ_TIMEOUT = 8

  def perform(delivery_id)
    delivery = WebhookDelivery.includes(:webhook_endpoint).find(delivery_id)
    return if delivery.status == "delivered"

    endpoint = delivery.webhook_endpoint
    return delivery.update!(status: "skipped") if endpoint.disabled_at

    body = delivery.payload.to_json
    response = connection(endpoint.url).post do |req|
      req.headers["Content-Type"] = "application/json"
      req.headers["Webhook-Id"] = delivery.event_id.to_s
      req.headers["Webhook-Signature"] = Webhooks::Signer.header(secret: endpoint.secret, body: body)
      req.body = body
    end

    record_attempt(delivery, response.status)

    case response.status
    when 200..299
      delivery.update!(status: "delivered", delivered_at: Time.current)
    when 410
      endpoint.disable!("endpoint returned 410 Gone")
      delivery.update!(status: "failed", last_error: "410 Gone")
    when 408, 429, 500..599
      raise RetryableError, "endpoint responded #{response.status}"
    else
      delivery.update!(status: "failed", last_error: "HTTP #{response.status}")
    end
  rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
    delivery&.update!(last_error: e.class.name)
    raise RetryableError, e.message
  end

  private

  def connection(url)
    Faraday.new(url: url) do |f|
      f.options.open_timeout = OPEN_TIMEOUT
      f.options.timeout = READ_TIMEOUT
      f.adapter Faraday.default_adapter
    end
  end

  def record_attempt(delivery, status)
    delivery.update!(attempts: delivery.attempts + 1, last_status: status)
  end
end
