# frozen_string_literal: true

module Access
  # Caches the flattened permission set of a user. Entries are written on a
  # miss and expire on their own after TTL.
  class PermissionCache
    TTL = 15.minutes
    VERSION = "v3"

    class << self
      def fetch(user)
        Rails.cache.fetch(key_for(user.id), expires_in: TTL, race_condition_ttl: 10.seconds) do
          PermissionSet.build(user)
        end
      end

      def expire(user)
        Rails.cache.delete(key_for(user.id))
      end

      def expire_many(user_ids)
        user_ids.each_slice(500) do |slice|
          Rails.cache.delete_multi(slice.map { |id| key_for(id) })
        end
      end

      private

      def key_for(user_id)
        "access/permissions/#{VERSION}/#{user_id}"
      end
    end
  end
end
