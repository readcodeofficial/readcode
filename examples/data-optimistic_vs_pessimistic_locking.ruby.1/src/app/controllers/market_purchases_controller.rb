class MarketPurchasesController < ApplicationController
  before_action :authenticate_player!

  def create
    listing = MarketPurchase.new(buyer: current_player, listing_id: params.require(:listing_id)).call
    render json: { listing_id: listing.id, item_id: listing.item_id, gold_left: current_player.gold }, status: :created
  rescue MarketPurchase::InsufficientGold => e
    render json: { error: "insufficient_gold", detail: e.message }, status: :payment_required
  rescue MarketPurchase::ListingUnavailable => e
    render json: { error: "listing_unavailable", detail: e.message }, status: :conflict
  rescue ActiveRecord::RecordNotFound
    render json: { error: "listing_not_found" }, status: :not_found
  end
end
