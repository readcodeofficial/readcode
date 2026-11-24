package com.acme.identity.auth;

public class AuthException extends Exception {

    public enum Code {
        INVALID_TOKEN(401),
        ACCOUNT_DISABLED(403),
        DIRECTORY_UNAVAILABLE(503),
        INTERNAL(500);

        private final int httpStatus;

        Code(int httpStatus) {
            this.httpStatus = httpStatus;
        }

        public int httpStatus() {
            return httpStatus;
        }
    }

    private final Code code;

    public AuthException(Code code, String message) {
        super(message);
        this.code = code;
    }

    public AuthException(Code code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public Code code() {
        return code;
    }
}
