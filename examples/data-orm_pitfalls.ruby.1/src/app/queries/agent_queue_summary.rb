class AgentQueueSummary
  PER_PAGE = 25
  OPEN_STATUSES = %w[open pending].freeze

  def initialize(agent)
    @agent = agent
  end

  def page(number, tag_names: [])
    scope = @agent.tickets.where(status: OPEN_STATUSES)
    scope = scope.tagged_with(tag_names) if tag_names.any?

    offset = (number.to_i.clamp(1, 10_000) - 1) * PER_PAGE
    scope.includes(:requester, :tags)
         .order(last_activity_at: :desc, id: :desc)
         .limit(PER_PAGE)
         .offset(offset)
  end

  def counts_by_status
    @agent.tickets.group(:status).count
  end

  def next_reply_emails
    @agent.tickets
          .where(status: "pending")
          .joins(:requester)
          .distinct
          .pluck("customers.email")
  end

  def busiest_threads(limit: 5)
    @agent.tickets
          .where(status: OPEN_STATUSES)
          .order(comments_count: :desc)
          .limit(limit)
          .pluck(:id, :subject, :comments_count)
          .map { |id, subject, count| { id: id, subject: subject, comments: count } }
  end
end
