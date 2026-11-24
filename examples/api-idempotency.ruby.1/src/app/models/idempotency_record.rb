class IdempotencyRecord < ApplicationRecord
  RETENTION = 24.hours

  validates :scope, :key, :fingerprint, :response_status, :response_body, presence: true

  scope :stale, -> { where("created_at < ?", RETENTION.ago) }

  def self.purge_stale!
    stale.in_batches(of: 1_000).delete_all
  end
end

# db/migrate/20240312_create_idempotency_records.rb
#   create_table :idempotency_records do |t|
#     t.string  :scope, null: false
#     t.string  :key, null: false
#     t.string  :fingerprint, null: false
#     t.integer :response_status, null: false
#     t.text    :response_body, null: false
#     t.timestamps
#   end
#   add_index :idempotency_records, [:scope, :key], unique: true
