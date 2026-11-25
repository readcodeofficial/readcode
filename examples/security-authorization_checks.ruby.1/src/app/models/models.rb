class User < ApplicationRecord
  enum :role, { customer: "customer", support: "support", warehouse: "warehouse", admin: "admin" }
end

class Order < ApplicationRecord
  FULFILLABLE_STATUSES = %w[paid picking packed].freeze

  belongs_to :user
  has_many :line_items
  has_many :refunds

  enum :status, {
    pending: "pending", paid: "paid", picking: "picking",
    packed: "packed", shipped: "shipped", cancelled: "cancelled"
  }

  def fulfillable?
    FULFILLABLE_STATUSES.include?(status)
  end

  def refundable_cents
    total_cents - refunded_cents
  end

  def refund!(amount_cents, by:)
    refunds.create!(amount_cents: amount_cents, issued_by: by)
    update!(refunded_cents: refunded_cents + amount_cents)
  end
end

class InventoryItem < ApplicationRecord
  def adjust!(delta, reason:)
    update!(on_hand: on_hand + delta, last_adjustment_reason: reason)
  end
end

class ApplicationController < ActionController::API
  include Pundit::Authorization
end
