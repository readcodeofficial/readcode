require "digest"
require "json"

class IdempotentRequest
  class KeyReuseError < StandardError; end

  Result = Struct.new(:status, :body, :replayed, keyword_init: true)

  def initialize(scope:, key:, payload:)
    @scope = scope
    @key = key
    @fingerprint = Digest::SHA256.hexdigest(JSON.generate(payload.sort.to_h))
  end

  def call
    existing = IdempotencyRecord.find_by(scope: @scope, key: @key)
    return replay(existing) if existing

    status, body = yield

    IdempotencyRecord.create!(
      scope: @scope,
      key: @key,
      fingerprint: @fingerprint,
      response_status: status,
      response_body: JSON.generate(body)
    )
    Result.new(status: status, body: body, replayed: false)
  rescue ActiveRecord::RecordNotUnique
    replay(IdempotencyRecord.find_by!(scope: @scope, key: @key))
  end

  private

  def replay(record)
    unless record.fingerprint == @fingerprint
      raise KeyReuseError, "Idempotency-Key was already used with a different request"
    end

    Result.new(
      status: record.response_status,
      body: JSON.parse(record.response_body),
      replayed: true
    )
  end
end
