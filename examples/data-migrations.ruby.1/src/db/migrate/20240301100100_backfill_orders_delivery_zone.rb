class BackfillOrdersDeliveryZone < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  BATCH_SIZE = 5_000
  PAUSE_SECONDS = 0.1

  class MigrationOrder < ActiveRecord::Base
    self.table_name = "orders"
  end

  def up
    MigrationOrder.where(delivery_zone_id: nil).in_batches(of: BATCH_SIZE) do |batch|
      ids = batch.pluck(:id)
      execute(<<~SQL.squish)
        UPDATE orders
        SET delivery_zone_id = restaurants.delivery_zone_id
        FROM restaurants
        WHERE restaurants.id = orders.restaurant_id
          AND orders.id IN (#{ids.join(",")})
          AND orders.delivery_zone_id IS NULL
      SQL
      sleep(PAUSE_SECONDS)
    end
  end

  def down
    # The column is dropped by the previous migration's rollback.
  end
end
