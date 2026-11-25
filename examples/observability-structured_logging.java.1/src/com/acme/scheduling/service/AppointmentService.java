package com.acme.scheduling.service;

import static net.logstash.logback.argument.StructuredArguments.kv;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

record Appointment(UUID id, UUID slotId, UUID patientId, String providerId, Instant startsAt) {}

class SlotTakenException extends RuntimeException {
    SlotTakenException(UUID slotId) {
        super("slot already booked: " + slotId);
    }
}

interface AppointmentStore {
    Optional<Appointment> bookIfFree(UUID slotId, UUID patientId, String providerId);

    List<Appointment> startingBetween(Instant from, Instant to);
}

interface SmsGateway {
    void send(UUID patientId, String template, Instant startsAt);
}

final class PatientRef {
    private PatientRef() {}

    static String of(UUID patientId) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(patientId.toString().getBytes(StandardCharsets.UTF_8));
            return "p_" + HexFormat.of().formatHex(digest, 0, 6);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

@Service
public class AppointmentService {

    private static final Logger log = LoggerFactory.getLogger(AppointmentService.class);

    private final AppointmentStore store;
    private final ReminderService reminders;

    public AppointmentService(AppointmentStore store, ReminderService reminders) {
        this.store = store;
        this.reminders = reminders;
    }

    public Appointment book(UUID slotId, UUID patientId, String providerId) {
        long started = System.nanoTime();
        log.info("appointment booking requested", kv("slotId", slotId), kv("providerId", providerId),
                kv("patientRef", PatientRef.of(patientId)));
        try {
            Appointment appointment = store.bookIfFree(slotId, patientId, providerId)
                    .orElseThrow(() -> new SlotTakenException(slotId));
            reminders.sendConfirmation(appointment);
            log.info("appointment booked", kv("appointmentId", appointment.id()), kv("slotId", slotId),
                    kv("durationMs", Duration.ofNanos(System.nanoTime() - started).toMillis()));
            return appointment;
        } catch (SlotTakenException e) {
            log.warn("slot already taken", kv("slotId", slotId), kv("providerId", providerId));
            throw e;
        } catch (RuntimeException e) {
            log.error("appointment booking failed", kv("slotId", slotId), e);
            throw e;
        }
    }
}

@Service
class ReminderService {

    private static final Logger log = LoggerFactory.getLogger(ReminderService.class);

    private final SmsGateway sms;

    ReminderService(SmsGateway sms) {
        this.sms = sms;
    }

    @Async("reminderExecutor")
    public void sendConfirmation(Appointment appointment) {
        sendTemplate(appointment, "confirmation");
    }

    @Async("reminderExecutor")
    public void sendDayBefore(Appointment appointment) {
        sendTemplate(appointment, "day_before");
    }

    private void sendTemplate(Appointment appointment, String template) {
        try {
            sms.send(appointment.patientId(), template, appointment.startsAt());
            log.info("reminder sent", kv("appointmentId", appointment.id()), kv("template", template));
        } catch (RuntimeException e) {
            log.error("reminder failed", kv("appointmentId", appointment.id()), kv("template", template), e);
        }
    }
}

@Component
class DayBeforeReminderJob {

    private static final Logger log = LoggerFactory.getLogger(DayBeforeReminderJob.class);

    private final AppointmentStore store;
    private final ReminderService reminders;

    DayBeforeReminderJob(AppointmentStore store, ReminderService reminders) {
        this.store = store;
        this.reminders = reminders;
    }

    @Scheduled(cron = "0 0 17 * * *")
    void run() {
        try (MDC.MDCCloseable ignored = MDC.putCloseable("jobRunId", UUID.randomUUID().toString())) {
            Instant from = Instant.now().plus(Duration.ofHours(24));
            List<Appointment> upcoming = store.startingBetween(from, from.plus(Duration.ofHours(24)));
            log.info("day-before reminders starting", kv("count", upcoming.size()));
            upcoming.forEach(reminders::sendDayBefore);
        }
    }
}
