package com.streamly.packaging;

import com.streamly.packaging.crypto.SegmentCipher;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

public class PackagingJob {

    private final SegmentCipher cipher = new SegmentCipher();
    private final SecretKey masterKey;
    private final KeyRegistry registry;
    private final SecureRandom random = new SecureRandom();

    public PackagingJob(Path keystorePath, char[] password, KeyRegistry registry)
            throws GeneralSecurityException, IOException {
        KeyStore store = KeyStore.getInstance("PKCS12");
        try (var in = Files.newInputStream(keystorePath)) {
            store.load(in, password);
        }
        this.masterKey = (SecretKey) store.getKey("packaging-master", password);
        this.registry = registry;
    }

    public void packageTitle(String titleId, List<Rendition> renditions, Path outDir)
            throws GeneralSecurityException, IOException {
        SecretKey titleKey = titleKeyFor(titleId);

        for (Rendition rendition : renditions) {
            Path renditionDir = Files.createDirectories(outDir.resolve(titleId).resolve(rendition.name()));
            long index = 0;
            for (byte[] segment : rendition.segments()) {
                byte[] sealed = cipher.encryptSegment(titleKey, rendition.name(), index, segment);
                Files.write(renditionDir.resolve(String.format("seg-%06d.enc", index)), sealed);
                index++;
            }
        }
    }

    private SecretKey titleKeyFor(String titleId) throws GeneralSecurityException {
        byte[] existing = registry.findWrappedKey(titleId);
        if (existing != null) {
            return new SecretKeySpec(cipher.unwrapTitleKey(masterKey, existing), "AES");
        }
        byte[] fresh = new byte[32];
        random.nextBytes(fresh);
        registry.saveWrappedKey(titleId, cipher.wrapTitleKey(masterKey, fresh));
        return new SecretKeySpec(fresh, "AES");
    }

    public interface KeyRegistry {
        byte[] findWrappedKey(String titleId);

        void saveWrappedKey(String titleId, byte[] wrapped);
    }

    public record Rendition(String name, List<byte[]> segments) { }
}
