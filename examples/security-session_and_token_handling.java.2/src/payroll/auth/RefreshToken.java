package payroll.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    private String id;

    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private String familyId;

    @Column(nullable = false)
    private String employeeId;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant usedAt;
    private Instant revokedAt;

    protected RefreshToken() {}

    public RefreshToken(String id, String tokenHash, String familyId, String employeeId, Instant expiresAt) {
        this.id = id;
        this.tokenHash = tokenHash;
        this.familyId = familyId;
        this.employeeId = employeeId;
        this.expiresAt = expiresAt;
    }

    public String getFamilyId() { return familyId; }
    public String getEmployeeId() { return employeeId; }
    public boolean isExpired(Instant now) { return !expiresAt.isAfter(now); }
    public boolean isUsed() { return usedAt != null; }
    public boolean isRevoked() { return revokedAt != null; }
    public void markUsed(Instant now) { this.usedAt = now; }
}
