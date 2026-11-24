require "openssl"

module Webhooks
  class Signer
    TOLERANCE_SECONDS = 300

    def self.sign(secret:, timestamp:, body:)
      OpenSSL::HMAC.hexdigest("SHA256", secret, "#{timestamp}.#{body}")
    end

    def self.header(secret:, body:, now: Time.now)
      ts = now.to_i
      "t=#{ts},v1=#{sign(secret: secret, timestamp: ts, body: body)}"
    end

    def self.valid?(secret:, header:, body:, now: Time.now)
      parts = header.to_s.split(",").map { |kv| kv.split("=", 2) }.to_h
      ts = parts["t"].to_i
      return false if (now.to_i - ts).abs > TOLERANCE_SECONDS

      expected = sign(secret: secret, timestamp: ts, body: body)
      ActiveSupport::SecurityUtils.secure_compare(expected, parts["v1"].to_s)
    end
  end
end
