class FleetReport
  BATCH_SIZE = 100
  MAX_SILENCE = 15.minutes

  def initialize(account, now: Time.current)
    @account = account
    @now = now
  end

  def each_site_summary
    return enum_for(:each_site_summary) unless block_given?

    @account.sites
            .includes(devices: :firmware)
            .find_in_batches(batch_size: BATCH_SIZE) do |sites|
      device_ids = sites.flat_map { |site| site.devices.map(&:id) }
      latest = Reading.latest_per_device(device_ids)
      open_alerts = Alert.open_counts_by_device(device_ids)

      sites.each do |site|
        yield summarize(site, latest, open_alerts)
      end
    end
  end

  private

  def summarize(site, latest, open_alerts)
    active = site.devices.reject(&:decommissioned_at)
    rows = active.map { |device| DeviceRow.build(device, latest[device.id], open_alerts.fetch(device.id, 0), @now) }

    {
      site_id: site.id,
      name: site.name,
      device_count: site.devices.size,
      active_count: active.size,
      stale_count: active.count { |device| device.stale?(@now, MAX_SILENCE) },
      open_alert_total: rows.sum { |row| row[:open_alerts] },
      devices: rows
    }
  end
end

module DeviceRow
  module_function

  def build(device, reading, open_alert_count, now)
    {
      id: device.id,
      serial: device.serial,
      firmware: device.firmware.version,
      last_seen_at: device.last_seen_at&.iso8601,
      temperature_c: reading&.temperature_c,
      battery_pct: reading&.battery_pct,
      open_alerts: open_alert_count,
      silent_for_s: device.last_seen_at && (now - device.last_seen_at).to_i
    }
  end
end
