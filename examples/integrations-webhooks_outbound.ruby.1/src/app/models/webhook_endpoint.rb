class WebhookEndpoint < ApplicationRecord
  has_many :webhook_deliveries, dependent: :destroy

  encrypts :secret

  validates :url, presence: true
  validate :url_must_be_https

  scope :enabled, -> { where(disabled_at: nil) }
  scope :subscribed_to, ->(event_type) { enabled.where("? = ANY(event_types)", event_type) }

  def disable!(reason)
    update!(disabled_at: Time.current, disabled_reason: reason)
  end

  private

  def url_must_be_https
    uri = URI.parse(url.to_s)
    errors.add(:url, "must use https") unless uri.is_a?(URI::HTTPS) && uri.host.present?
  rescue URI::InvalidURIError
    errors.add(:url, "is not a valid URL")
  end
end
