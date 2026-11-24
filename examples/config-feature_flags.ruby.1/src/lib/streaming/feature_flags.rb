require "zlib"
require "json"

module Streaming
  class FeatureFlags
    CACHE_TTL = 30

    Flag = Struct.new(:key, :enabled, :rollout_percent, :allow_plans, :allow_users, keyword_init: true)

    def initialize(store:, clock: -> { Process.clock_gettime(Process::CLOCK_MONOTONIC) }, logger: nil)
      @store = store
      @clock = clock
      @logger = logger
      @mutex = Mutex.new
      @flags = {}
      @loaded_at = nil
    end

    def enabled?(key, user_id:, plan: nil)
      flag = lookup(key.to_s)
      return false if flag.nil?
      return false unless flag.enabled
      return true if flag.allow_users.include?(user_id.to_s)
      return true if plan && flag.allow_plans.include?(plan.to_s)

      in_rollout?(user_id, flag.rollout_percent)
    end

    private

    def in_rollout?(user_id, percent)
      return false if percent <= 0
      return true if percent >= 100

      Zlib.crc32(user_id.to_s) % 100 < percent
    end

    def lookup(key)
      refresh_if_stale
      @mutex.synchronize { @flags[key] }
    end

    def refresh_if_stale
      now = @clock.call
      stale = @mutex.synchronize { @loaded_at.nil? || now - @loaded_at > CACHE_TTL }
      return unless stale

      fresh = load_flags
      @mutex.synchronize do
        @flags = fresh
        @loaded_at = now
      end
    rescue StandardError => e
      @logger&.warn("flag refresh failed: #{e.class}: #{e.message}")
    end

    def load_flags
      JSON.parse(@store.get("flags:streaming")).each_with_object({}) do |(key, attrs), acc|
        acc[key] = Flag.new(
          key: key,
          enabled: attrs.fetch("enabled", false),
          rollout_percent: attrs.fetch("rollout_percent", 0).to_i.clamp(0, 100),
          allow_plans: Array(attrs["allow_plans"]).map(&:to_s),
          allow_users: Array(attrs["allow_users"]).map(&:to_s)
        )
      end
    end
  end
end
