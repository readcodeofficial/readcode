package com.carepath.scheduling.service;

import com.carepath.scheduling.model.Appointment;
import com.carepath.scheduling.model.AppointmentSlot;
import com.carepath.scheduling.model.SlotStatus;
import com.carepath.scheduling.repo.AppointmentRepository;
import com.carepath.scheduling.repo.PatientRepository;
import com.carepath.scheduling.repo.SlotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentBooker {

    private final PatientRepository patients;
    private final SlotRepository slots;
    private final AppointmentRepository appointments;

    public AppointmentBooker(PatientRepository patients, SlotRepository slots,
                             AppointmentRepository appointments) {
        this.patients = patients;
        this.slots = slots;
        this.appointments = appointments;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED, rollbackFor = Exception.class)
    public Appointment book(long patientId, long slotId) throws BookingException {
        patients.findForUpdate(patientId)
                .orElseThrow(() -> new BookingException(BookingException.Reason.UNKNOWN_PATIENT));

        AppointmentSlot slot = slots.findForUpdate(slotId)
                .orElseThrow(() -> new BookingException(BookingException.Reason.UNKNOWN_SLOT));

        if (slot.getStatus() != SlotStatus.OPEN) {
            throw new BookingException(BookingException.Reason.SLOT_TAKEN);
        }
        if (appointments.existsOverlapping(patientId, slot.getStartsAt(), slot.getEndsAt())) {
            throw new BookingException(BookingException.Reason.PATIENT_DOUBLE_BOOKED);
        }

        slot.markBooked();
        return appointments.save(Appointment.confirmed(patientId, slot));
    }
}
