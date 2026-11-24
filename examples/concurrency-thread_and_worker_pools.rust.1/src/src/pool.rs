use std::sync::mpsc::{self, Receiver, SendError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

type Job = Box<dyn FnOnce() + Send + 'static>;

pub struct WorkerPool {
    sender: Option<Sender<Job>>,
    workers: Vec<Worker>,
}

struct Worker {
    id: usize,
    handle: Option<JoinHandle<()>>,
}

impl WorkerPool {
    pub fn new(size: usize) -> WorkerPool {
        assert!(size > 0, "pool needs at least one worker");

        let (sender, receiver) = mpsc::channel::<Job>();
        let receiver = Arc::new(Mutex::new(receiver));

        let workers = (0..size)
            .map(|id| Worker::spawn(id, Arc::clone(&receiver)))
            .collect();

        WorkerPool {
            sender: Some(sender),
            workers,
        }
    }

    pub fn submit<F>(&self, job: F) -> Result<(), SendError<Job>>
    where
        F: FnOnce() + Send + 'static,
    {
        match &self.sender {
            Some(tx) => tx.send(Box::new(job)),
            None => Err(SendError(Box::new(job))),
        }
    }
}

impl Worker {
    fn spawn(id: usize, receiver: Arc<Mutex<Receiver<Job>>>) -> Worker {
        let handle = thread::Builder::new()
            .name(format!("ticket-worker-{id}"))
            .spawn(move || {
                while let Ok(job) = receiver.lock().unwrap().recv() {
                    job();
                }
            })
            .expect("failed to spawn worker thread");

        Worker {
            id,
            handle: Some(handle),
        }
    }
}

impl Drop for WorkerPool {
    fn drop(&mut self) {
        drop(self.sender.take());
        for worker in &mut self.workers {
            if let Some(handle) = worker.handle.take() {
                if handle.join().is_err() {
                    eprintln!("worker {} panicked", worker.id);
                }
            }
        }
    }
}
