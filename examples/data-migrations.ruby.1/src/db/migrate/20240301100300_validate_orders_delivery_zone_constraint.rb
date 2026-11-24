class ValidateOrdersDeliveryZoneConstraint < ActiveRecord::Migration[7.1]
  def up
    validate_check_constraint :orders, name: "orders_delivery_zone_id_null"
  end

  def down
    # Validation cannot be reversed; the constraint itself is removed by the previous migration.
  end
end
