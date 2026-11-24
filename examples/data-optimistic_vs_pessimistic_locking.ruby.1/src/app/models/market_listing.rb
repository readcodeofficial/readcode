class MarketListing < ApplicationRecord
  belongs_to :seller, class_name: "Player"
  belongs_to :buyer, class_name: "Player", optional: true

  STATUSES = %w[active sold cancelled].freeze

  validates :status, inclusion: { in: STATUSES }
  validates :price_gold, numericality: { only_integer: true, greater_than: 0 }

  scope :open_for_sale, -> { where(status: "active").where("expires_at > ?", Time.current) }

  def active?
    status == "active" && expires_at.future?
  end
end
