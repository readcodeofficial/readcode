# frozen_string_literal: true

module Access
  PermissionSet = Struct.new(:user_id, :roles, :scopes, keyword_init: true) do
    def self.build(user)
      direct = user.role_assignments.includes(:role).map(&:role)
      via_groups = user.groups.includes(:roles).flat_map(&:roles)
      roles = (direct + via_groups).uniq

      new(
        user_id: user.id,
        roles: roles.map(&:name).sort,
        scopes: roles.flat_map(&:scopes).uniq.sort
      )
    end

    def allows?(scope)
      scopes.include?(scope)
    end
  end
end
