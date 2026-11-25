package com.helpdesk.auth;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth")
class SessionController {

    private static final String COOKIE = "hd_refresh";

    private final RefreshTokenService refreshTokens;

    SessionController(RefreshTokenService refreshTokens) {
        this.refreshTokens = refreshTokens;
    }

    @PostMapping("/refresh")
    AccessTokenResponse refresh(@CookieValue(name = COOKIE, required = false) String presented,
                                HttpServletResponse response) {
        if (presented == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        try {
            TokenPair pair = refreshTokens.rotate(presented);
            response.addHeader(HttpHeaders.SET_COOKIE, cookie(pair.refreshToken(), Duration.ofDays(14)).toString());
            return new AccessTokenResponse(pair.accessToken());
        } catch (InvalidTokenException e) {
            response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
    }

    @PostMapping("/logout")
    void logout(@CookieValue(name = COOKIE, required = false) String presented, HttpServletResponse response) {
        if (presented != null) {
            refreshTokens.endSession(presented);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
    }

    private static ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE, value)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/auth")
                .maxAge(maxAge)
                .build();
    }

    record AccessTokenResponse(String accessToken) {}
}
