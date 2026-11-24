class AddDeliveryZoneToOrders < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def up
    add_column :orders, :delivery_zone_id, :bigint, if_not_exists: true
    add_index :orders, :delivery_zone_id,
              algorithm: :concurrently,
              if_not_exists: true
  end

  def down
    remove_index :orders, :delivery_zone_id,
                 algorithm: :concurrently,
                 if_exists: true
    remove_column :orders, :delivery_zone_id, if_exists: true
  end
end
