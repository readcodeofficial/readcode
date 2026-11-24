class Comment < ApplicationRecord
  belongs_to :ticket, counter_cache: true
  belongs_to :author, polymorphic: true

  validates :body, presence: true
end

class Agent < ApplicationRecord
  has_many :tickets, foreign_key: :assignee_id, inverse_of: :assignee, dependent: :nullify
end

class TicketEvent < ApplicationRecord
  belongs_to :ticket
end
