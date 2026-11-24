class PayrollRunsController < ApplicationController
  before_action :require_idempotency_key

  def create
    outcome = IdempotentRequest.new(
      scope: "company:#{current_company.id}",
      key: idempotency_key,
      payload: run_params.to_h
    ).call do
      run = PayrollDisbursement.new(
        company: current_company,
        period_end: run_params[:period_end],
        employee_ids: run_params[:employee_ids]
      ).call
      [201, { id: run.id, total_cents: run.total_cents, payment_count: run.payments.size }]
    end

    response.set_header("Idempotent-Replayed", "true") if outcome.replayed
    render json: outcome.body, status: outcome.status
  rescue IdempotentRequest::KeyReuseError => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue PayrollDisbursement::PeriodClosed => e
    render json: { error: e.message }, status: :conflict
  end

  private

  def idempotency_key
    request.headers["Idempotency-Key"]
  end

  def require_idempotency_key
    return if idempotency_key.present? && idempotency_key.length <= 255

    render json: { error: "Idempotency-Key header is required" }, status: :bad_request
  end

  def run_params
    params.require(:payroll_run).permit(:period_end, employee_ids: [])
  end
end
