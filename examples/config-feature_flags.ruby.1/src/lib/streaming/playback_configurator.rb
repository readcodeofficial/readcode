require_relative "feature_flags"

module Streaming
  class PlaybackConfigurator
    DEFAULT_LADDER = %w[480p 720p 1080p].freeze

    def initialize(flags)
      @flags = flags
    end

    def for_session(user_id:, plan:)
      ladder = DEFAULT_LADDER.dup
      ladder << "2160p" if @flags.enabled?(:uhd_streaming, user_id: user_id, plan: plan)

      {
        bitrate_ladder: ladder,
        low_latency_hls: @flags.enabled?(:low_latency_hls, user_id: user_id),
        new_player_ui: @flags.enabled?(:new_player_ui, user_id: user_id, plan: plan)
      }
    end
  end
end
