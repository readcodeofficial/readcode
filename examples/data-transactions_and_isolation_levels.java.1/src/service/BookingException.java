package com.carepath.scheduling.service;

public class BookingException extends Exception {

    public enum Reason { UNKNOWN_PATIENT, UNKNOWN_SLOT, SLOT_TAKEN, PATIENT_DOUBLE_BOOKED, BUSY }

    private final Reason reason;

    public BookingException(Reason reason) {
        super(reason.name());
        this.reason = reason;
    }

    public BookingException(Reason reason, Throwable cause) {
        super(reason.name(), cause);
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}
