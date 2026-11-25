package lending.model;

public record LoanApplication(
        String id,
        String applicantName,
        String ssn,
        String dateOfBirth,
        long amountCents) {

    public String maskedSsn() {
        if (ssn == null || ssn.length() < 4) {
            return "***";
        }
        return "***-**-" + ssn.substring(ssn.length() - 4);
    }

    public boolean exceeds(long limitCents) {
        return amountCents > limitCents;
    }
}
