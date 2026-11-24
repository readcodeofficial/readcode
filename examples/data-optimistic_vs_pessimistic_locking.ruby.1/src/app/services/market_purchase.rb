class MarketPurchase
  class ListingUnavailable < StandardError; end
  class InsufficientGold < StandardError; end

  MAX_ATTEMPTS = 3

  def initialize(buyer:, listing_id:)
    @buyer = buyer
    @listing_id = listing_id
  end

  def call
    attempts = 0
    begin
      attempts += 1
      perform
    rescue ActiveRecord::StaleObjectError
      retry if attempts < MAX_ATTEMPTS
      raise ListingUnavailable, "listing #{@listing_id} changed while purchasing"
    end
  end

  private

  def perform
    ApplicationRecord.transaction do
      listing = MarketListing.find(@listing_id)
      raise ListingUnavailable, "listing #{listing.id} is not for sale" unless listing.active?

      @buyer.with_lock do
        raise InsufficientGold, "need #{listing.price_gold} gold" if @buyer.gold < listing.price_gold

        @buyer.update!(gold: @buyer.gold - listing.price_gold)
      end

      listing.update!(status: "sold", buyer: @buyer, sold_at: Time.current)

      seller = Player.find(listing.seller_id)
      seller.update!(gold: seller.gold + listing.price_gold)

      @buyer.grant_item!(listing.item_id)
      listing
    end
  end
end
