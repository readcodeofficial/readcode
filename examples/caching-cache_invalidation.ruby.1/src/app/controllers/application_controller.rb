# frozen_string_literal: true

module Access
  class Authorizer
    class Denied < StandardError; end

    def initialize(user)
      @user = user
    end

    def allowed?(scope)
      PermissionCache.fetch(@user).allows?(scope)
    end

    def require!(scope)
      return if allowed?(scope)

      raise Denied, "missing scope #{scope}"
    end
  end
end

class ApplicationController < ActionController::API
  rescue_from Access::Authorizer::Denied do |error|
    render json: { error: "forbidden", detail: error.message }, status: :forbidden
  end

  private

  def authorize!(scope)
    Access::Authorizer.new(current_user).require!(scope)
  end
end
