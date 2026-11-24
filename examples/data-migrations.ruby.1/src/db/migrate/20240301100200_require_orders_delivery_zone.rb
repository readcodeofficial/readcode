class RequireOrdersDeliveryZone < ActiveRecord::Migration[7.1]
  def up
    add_check_constraint :orders,
                         "delivery_zone_id IS NOT NULL",
                         name: "orders_delivery_zone_id_null",
                         validate: false
  end

  def down
    remove_check_constraint :orders, name: "orders_delivery_zone_id_null"
  end
end
