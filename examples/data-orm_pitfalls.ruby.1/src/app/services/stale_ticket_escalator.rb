class StaleTicketEscalator
  BATCH_SIZE = 500

  def initialize(threshold: 48.hours, now: Time.current)
    @cutoff = now - threshold
    @now = now
  end

  def call
    escalated = 0

    Ticket.stale(@cutoff).in_batches(of: BATCH_SIZE) do |batch|
      candidate_ids = batch.pluck(:id)
      escalated += escalate(candidate_ids)
    end

    escalated
  end

  private

  def escalate(candidate_ids)
    Ticket.transaction do
      ids = Ticket.stale(@cutoff).where(id: candidate_ids).order(:id).lock.pluck(:id)
      return 0 if ids.empty?

      Ticket.where(id: ids).update_all(
        status: Ticket.statuses.fetch("escalated"),
        escalated_at: @now,
        updated_at: @now
      )
      TicketEvent.insert_all!(
        ids.map { |id| { ticket_id: id, kind: "auto_escalated", created_at: @now, updated_at: @now } }
      )
      ids.size
    end
  end
end
