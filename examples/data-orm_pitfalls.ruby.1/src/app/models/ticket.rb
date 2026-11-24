class Ticket < ApplicationRecord
  belongs_to :requester, class_name: "Customer"
  belongs_to :assignee, class_name: "Agent", optional: true, inverse_of: :tickets
  has_many :comments, dependent: :destroy
  has_many :taggings, dependent: :destroy
  has_many :tags, through: :taggings
  has_many :events, class_name: "TicketEvent", dependent: :delete_all

  enum :status, { open: 0, pending: 1, escalated: 2, solved: 3 }

  validates :subject, presence: true, length: { maximum: 200 }

  scope :stale, ->(cutoff) { where(status: %w[open pending]).where("last_activity_at < ?", cutoff) }
  scope :tagged_with, lambda { |names|
    where(id: Tagging.joins(:tag).where(tags: { name: names }).select(:ticket_id))
  }

  def record_agent_reply!(at: Time.current)
    with_lock do
      update!(status: :pending, last_activity_at: at)
      events.create!(kind: "agent_reply")
    end
  end
end
