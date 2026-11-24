package com.streamly.packaging.crypto;

import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SegmentCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int TAG_BITS = 128;
    private static final int NONCE_BYTES = 12;

    private final SecureRandom random = new SecureRandom();

    public byte[] encryptSegment(SecretKey titleKey, String rendition, long segmentIndex, byte[] plain)
            throws GeneralSecurityException {
        byte[] nonce = nonceFor(segmentIndex);
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, titleKey, new GCMParameterSpec(TAG_BITS, nonce));
        cipher.updateAAD(aad(rendition, segmentIndex));
        return cipher.doFinal(plain);
    }

    public byte[] decryptSegment(SecretKey titleKey, String rendition, long segmentIndex, byte[] sealed)
            throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, titleKey, new GCMParameterSpec(TAG_BITS, nonceFor(segmentIndex)));
        cipher.updateAAD(aad(rendition, segmentIndex));
        return cipher.doFinal(sealed);
    }

    public byte[] wrapTitleKey(SecretKey masterKey, byte[] titleKeyBytes) throws GeneralSecurityException {
        byte[] iv = new byte[NONCE_BYTES];
        random.nextBytes(iv);
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, masterKey, new GCMParameterSpec(TAG_BITS, iv));
        byte[] wrapped = cipher.doFinal(titleKeyBytes);
        return ByteBuffer.allocate(iv.length + wrapped.length).put(iv).put(wrapped).array();
    }

    public byte[] unwrapTitleKey(SecretKey masterKey, byte[] blob) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, masterKey, new GCMParameterSpec(TAG_BITS, blob, 0, NONCE_BYTES));
        return cipher.doFinal(blob, NONCE_BYTES, blob.length - NONCE_BYTES);
    }

    private static byte[] nonceFor(long segmentIndex) {
        return ByteBuffer.allocate(NONCE_BYTES).putInt(0).putLong(segmentIndex).array();
    }

    private static byte[] aad(String rendition, long segmentIndex) {
        return (rendition + "/" + segmentIndex).getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
}
