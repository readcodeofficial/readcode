package com.carepath.scheduling.repo;

import com.carepath.scheduling.model.Appointment;
import com.carepath.scheduling.model.AppointmentSlot;
import com.carepath.scheduling.model.Patient;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

public interface SlotRepository extends JpaRepository<AppointmentSlot, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("select s from AppointmentSlot s where s.id = :id")
    Optional<AppointmentSlot> findForUpdate(@Param("id") long id);
}

interface PatientRepository extends JpaRepository<Patient, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("select p from Patient p where p.id = :id")
    Optional<Patient> findForUpdate(@Param("id") long id);
}

interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    @Query("""
        select count(a) > 0 from Appointment a
        where a.patientId = :patientId
          and a.status = com.carepath.scheduling.model.AppointmentStatus.CONFIRMED
          and a.startsAt < :endsAt and a.endsAt > :startsAt
        """)
    boolean existsOverlapping(@Param("patientId") long patientId,
                              @Param("startsAt") Instant startsAt,
                              @Param("endsAt") Instant endsAt);
}
