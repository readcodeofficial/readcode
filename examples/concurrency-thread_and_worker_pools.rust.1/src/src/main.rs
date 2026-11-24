mod pool;

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use pool::WorkerPool;

#[derive(Debug, Clone)]
struct Ticket {
    id: u64,
    subject: String,
    body: String,
}

fn classify(ticket: &Ticket) -> &'static str {
    let text = ticket.body.to_lowercase();
    if text.contains("refund") || text.contains("charge") {
        "billing"
    } else if text.contains("password") || text.contains("login") {
        "account"
    } else {
        "general"
    }
}

fn enrich_from_crm(ticket: &Ticket) -> usize {
    // Stand-in for a blocking HTTP call to the CRM.
    std::thread::sleep(Duration::from_millis(150));
    ticket.subject.len()
}

fn main() {
    let pool = WorkerPool::new(4);
    let routed = Arc::new(AtomicUsize::new(0));

    let tickets: Vec<Ticket> = (1..=12)
        .map(|id| Ticket {
            id,
            subject: format!("Ticket #{id}"),
            body: if id % 3 == 0 {
                "I was charged twice, need a refund".to_string()
            } else {
                "I cannot login after the password reset".to_string()
            },
        })
        .collect();

    for ticket in tickets {
        let routed = Arc::clone(&routed);
        pool.submit(move || {
            let queue = classify(&ticket);
            let weight = enrich_from_crm(&ticket);
            println!("ticket {} -> {} (weight {})", ticket.id, queue, weight);
            routed.fetch_add(1, Ordering::SeqCst);
        })
        .expect("pool is accepting jobs");
    }

    drop(pool);
    println!("routed {} tickets", routed.load(Ordering::SeqCst));
}
