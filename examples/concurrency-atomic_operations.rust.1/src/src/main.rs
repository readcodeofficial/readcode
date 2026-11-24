mod inventory;
mod orders;

use std::sync::Arc;
use std::thread;

use inventory::Inventory;
use orders::{OrderLine, OrderService};

fn main() {
    let inventory = Arc::new(Inventory::new(vec![
        ("SKU-LAMP-01".to_string(), 25),
        ("SKU-DESK-07".to_string(), 10),
    ]));
    let service = Arc::new(OrderService::new(Arc::clone(&inventory)));

    let handles: Vec<_> = (0..8)
        .map(|worker| {
            let service = Arc::clone(&service);
            thread::spawn(move || {
                let lines = vec![
                    OrderLine { sku: "SKU-LAMP-01".to_string(), qty: 2 },
                    OrderLine { sku: "SKU-DESK-07".to_string(), qty: 1 },
                ];
                match service.place_order(&lines) {
                    Ok(id) => println!("worker {worker}: placed {id:?}"),
                    Err(err) => println!("worker {worker}: rejected {err:?}"),
                }
            })
        })
        .collect();

    for handle in handles {
        handle.join().expect("worker panicked");
    }

    service.start_draining();
    println!(
        "placed={} lamp={:?} desk={:?}",
        service.placed_count(),
        inventory.available("SKU-LAMP-01"),
        inventory.available("SKU-DESK-07"),
    );
}
