class Order < ApplicationRecord
  belongs_to :restaurant
  belongs_to :delivery_zone, optional: true

  before_validation :assign_delivery_zone, on: :create

  private

  def assign_delivery_zone
    self.delivery_zone_id ||= restaurant&.delivery_zone_id
  end
end
