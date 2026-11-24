class PayrollDisbursement
  class PeriodClosed < StandardError; end

  def initialize(company:, period_end:, employee_ids:)
    @company = company
    @period_end = Date.iso8601(period_end)
    @employee_ids = employee_ids
  end

  def call
    run = PayrollRun.transaction do
      if @company.payroll_runs.closed.exists?(period_end: @period_end)
        raise PeriodClosed, "pay period ending #{@period_end} is already closed"
      end

      run = @company.payroll_runs.create!(period_end: @period_end, status: "submitted")
      @company.employees.where(id: @employee_ids).find_each do |employee|
        run.payments.create!(
          employee: employee,
          amount_cents: PayCalculator.net_cents(employee, @period_end),
          status: "queued"
        )
      end
      run.update!(total_cents: run.payments.sum(:amount_cents))
      run
    end

    AchBatchJob.perform_later(run.id)
    run
  end
end
