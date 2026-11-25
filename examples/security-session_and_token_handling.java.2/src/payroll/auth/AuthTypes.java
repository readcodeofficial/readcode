package payroll.auth;

import java.util.List;

record TokenPair(String accessToken, String refreshToken) {}

interface EmployeeDirectory {
    boolean isActive(String employeeId);

    List<String> rolesOf(String employeeId);
}

interface SigningKeyProvider {
    byte[] currentSecret();
}

class InvalidTokenException extends RuntimeException {
    InvalidTokenException(String message) {
        super(message);
    }
}

class TokenReuseException extends RuntimeException {
    private final String familyId;

    TokenReuseException(String familyId) {
        super("refresh token reuse detected");
        this.familyId = familyId;
    }

    String familyId() {
        return familyId;
    }
}
