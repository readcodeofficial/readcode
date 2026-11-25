class Site < ApplicationRecord
  belongs_to :account
  has_many :devices, dependent: :destroy
end

class Firmware < ApplicationRecord
  has_many :devices
end

class Device < ApplicationRecord
  belongs_to :site
  belongs_to :firmware
  has_many :readings, dependent: :delete_all
  has_many :alerts, dependent: :delete_all

  scope :active, -> { where(decommissioned_at: nil) }

  def stale?(now, max_silence)
    last_seen_at.nil? || last_seen_at < now - max_silence
  end
end

class Reading < ApplicationRecord
  belongs_to :device
  # columns: device_id, recorded_at, temperature_c, battery_pct

  def self.latest_per_device(device_ids)
    where(device_id: device_ids)
      .select("DISTINCT ON (device_id) readings.*")
      .order(:device_id, recorded_at: :desc)
      .index_by(&:device_id)
  end
end

class Alert < ApplicationRecord
  belongs_to :device

  scope :unresolved, -> { where(resolved_at: nil) }

  def self.open_counts_by_device(device_ids)
    unresolved.where(device_id: device_ids).group(:device_id).count
  end
end
