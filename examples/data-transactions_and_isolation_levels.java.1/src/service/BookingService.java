package com.carepath.scheduling.service;

import com.carepath.scheduling.model.Appointment;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Service;

@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);
    private static final int MAX_ATTEMPTS = 3;

    private final AppointmentBooker booker;

    public BookingService(AppointmentBooker booker) {
        this.booker = booker;
    }

    public Appointment bookSlot(long patientId, long slotId) throws BookingException {
        PessimisticLockingFailureException lastFailure = null;

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return booker.book(patientId, slotId);
            } catch (PessimisticLockingFailureException e) {
                lastFailure = e;
                log.warn("Lock contention booking slot {} for patient {} (attempt {})",
                        slotId, patientId, attempt);
                pauseBeforeRetry(attempt);
            }
        }
        throw new BookingException(BookingException.Reason.BUSY, lastFailure);
    }

    private static void pauseBeforeRetry(int attempt) {
        long base = 50L << attempt;
        long jitter = ThreadLocalRandom.current().nextLong(base);
        try {
            Thread.sleep(base + jitter);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
