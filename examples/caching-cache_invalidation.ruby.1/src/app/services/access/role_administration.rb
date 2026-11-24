# frozen_string_literal: true

module Access
  class RoleAdministration
    def initialize(audit_log: AuditLog)
      @audit_log = audit_log
    end

    def grant_role(user, role, granted_by:)
      User.transaction do
        user.role_assignments.find_or_create_by!(role: role)
        @audit_log.record(:role_granted, user: user, role: role, actor: granted_by)
      end
      PermissionCache.expire(user)
    end

    def revoke_role(user, role, revoked_by:)
      User.transaction do
        user.role_assignments.where(role: role).destroy_all
        PermissionCache.expire(user)
        @audit_log.record(:role_revoked, user: user, role: role, actor: revoked_by)
      end
    end

    def update_group_roles(group, role_ids, updated_by:)
      member_ids = []
      Group.transaction do
        group.role_ids = role_ids
        @audit_log.record(:group_roles_updated, group: group, actor: updated_by)
        member_ids = group.memberships.pluck(:user_id)
      end
      PermissionCache.expire_many(member_ids)
    end
  end
end
