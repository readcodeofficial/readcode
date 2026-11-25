package lending.service;

import java.util.ArrayList;
import java.util.List;

import lending.log.Logger;
import lending.model.LoanApplication;

public final class ApplicationService {

    public enum Decision { APPROVED, REJECTED }

    private final Logger log;
    private final long limitCents;
    private final List<LoanApplication> approved = new ArrayList<>();

    public ApplicationService(Logger log, long limitCents) {
        this.log = log;
        this.limitCents = limitCents;
    }

    public Decision submit(LoanApplication application) {
        log.info("application received: " + application);
        if (application.exceeds(limitCents)) {
            log.warn("application rejected, over limit of " + limitCents + ": " + application);
            return Decision.REJECTED;
        }
        approved.add(application);
        log.info("application approved id=" + application.id() + " ssn=" + application.maskedSsn());
        return Decision.APPROVED;
    }

    public List<LoanApplication> approved() {
        return List.copyOf(approved);
    }
}
