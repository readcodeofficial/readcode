class OrdersController < ApplicationController
  class InvalidAmount < StandardError; end

  before_action :authenticate_user!
  after_action :verify_authorized, except: :index
  after_action :verify_policy_scoped, only: :index

  rescue_from Pundit::NotAuthorizedError, with: :deny_access
  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "not_found" }, status: :not_found
  end

  def index
    orders = policy_scope(Order).includes(:line_items).order(created_at: :desc).limit(50)
    render json: orders
  end

  def show
    order = Order.find(params[:id])
    authorize order
    render json: order
  end

  def update
    order = Order.find(params[:id])
    authorize order
    if order.update(permitted_attributes(order))
      render json: order
    else
      render json: { errors: order.errors }, status: :unprocessable_entity
    end
  end

  def refund
    order = nil
    amount = params.require(:amount_cents).to_i
    Order.transaction do
      order = Order.lock.find(params[:id])
      authorize order, :refund?
      raise InvalidAmount unless amount.between?(1, order.refundable_cents)

      order.refund!(amount, by: current_user)
    end
    render json: order
  rescue InvalidAmount
    render json: { error: "invalid_amount" }, status: :unprocessable_entity
  end

  private

  def deny_access
    status = action_name == "show" ? :not_found : :forbidden
    render json: { error: status.to_s }, status: status
  end
end

class InventoryAdjustmentsController < ApplicationController
  before_action :authenticate_user!
  after_action :verify_authorized

  rescue_from Pundit::NotAuthorizedError do
    render json: { error: "forbidden" }, status: :forbidden
  end

  def create
    item = InventoryItem.find(params[:inventory_item_id])
    authorize item, :adjust?
    item.adjust!(params.require(:delta).to_i, reason: params.require(:reason))
    render json: item, status: :created
  end
end
