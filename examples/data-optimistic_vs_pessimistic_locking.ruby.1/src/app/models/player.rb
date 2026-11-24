class Player < ApplicationRecord
  has_many :player_items, dependent: :destroy
  has_many :listings, class_name: "MarketListing", foreign_key: :seller_id

  validates :gold, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  def grant_item!(item_id, quantity: 1)
    slot = player_items.create_or_find_by!(item_id: item_id)
    slot.with_lock do
      slot.update!(quantity: slot.quantity + quantity)
    end
  end
end
