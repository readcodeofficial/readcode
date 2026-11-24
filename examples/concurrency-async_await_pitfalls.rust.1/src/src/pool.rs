use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct DriverId(pub u64);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum DriverState {
    Available,
    Offered(u64),
    OnTrip,
}

struct DriverEntry {
    location: (f64, f64),
    state: DriverState,
}

#[derive(Default)]
pub struct DriverPool {
    drivers: Mutex<HashMap<DriverId, DriverEntry>>,
}

fn distance_sq(a: (f64, f64), b: (f64, f64)) -> f64 {
    (a.0 - b.0).powi(2) + (a.1 - b.1).powi(2)
}

impl DriverPool {
    pub fn set_available(&self, id: DriverId, location: (f64, f64)) {
        let mut drivers = self.drivers.lock().unwrap();
        drivers.insert(id, DriverEntry { location, state: DriverState::Available });
    }

    pub fn reserve_nearest(&self, ride_id: u64, pickup: (f64, f64)) -> Option<DriverId> {
        let mut drivers = self.drivers.lock().unwrap();
        let id = drivers
            .iter()
            .filter(|(_, e)| e.state == DriverState::Available)
            .min_by(|a, b| {
                distance_sq(a.1.location, pickup).total_cmp(&distance_sq(b.1.location, pickup))
            })
            .map(|(id, _)| *id)?;
        if let Some(entry) = drivers.get_mut(&id) {
            entry.state = DriverState::Offered(ride_id);
        }
        Some(id)
    }

    pub fn confirm(&self, id: DriverId, ride_id: u64) -> bool {
        let mut drivers = self.drivers.lock().unwrap();
        match drivers.get_mut(&id) {
            Some(entry) if entry.state == DriverState::Offered(ride_id) => {
                entry.state = DriverState::OnTrip;
                true
            }
            _ => false,
        }
    }

    pub fn release(&self, id: DriverId, ride_id: u64) {
        let mut drivers = self.drivers.lock().unwrap();
        if let Some(entry) = drivers.get_mut(&id) {
            if entry.state == DriverState::Offered(ride_id) {
                entry.state = DriverState::Available;
            }
        }
    }
}
