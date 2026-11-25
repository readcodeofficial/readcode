class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    raise Pundit::NotAuthorizedError, "must be logged in" unless user

    @user = user
    @record = record
  end

  def index?
    false
  end

  def show?
    false
  end

  def update?
    false
  end

  class Scope
    def initialize(user, scope)
      raise Pundit::NotAuthorizedError, "must be logged in" unless user

      @user = user
      @scope = scope
    end

    def resolve
      raise NotImplementedError, "#{self.class} must implement #resolve"
    end

    private

    attr_reader :user, :scope
  end
end

class OrderPolicy < ApplicationPolicy
  REFUND_LIMIT_CENTS = 50_000

  def index?
    true
  end

  def show?
    staff? || owner? || (user.warehouse? && record.fulfillable?)
  end

  def update?
    user.admin? || (owner? && record.pending?)
  end

  def refund?
    return false unless record.paid? && record.refundable_cents.positive?

    user.admin? || (user.support? && record.refundable_cents <= REFUND_LIMIT_CENTS)
  end

  def permitted_attributes
    if user.admin?
      %i[shipping_address_id gift_note internal_notes]
    else
      %i[shipping_address_id gift_note]
    end
  end

  class Scope < ApplicationPolicy::Scope
    def resolve
      return scope.all if user.admin? || user.support?
      return scope.where(status: Order::FULFILLABLE_STATUSES) if user.warehouse?

      scope.where(user_id: user.id)
    end
  end

  private

  def owner?
    record.user_id == user.id
  end

  def staff?
    user.admin? || user.support?
  end
end

class InventoryItemPolicy < ApplicationPolicy
  def adjust?
    user.warehouse? || user.admin?
  end
end
