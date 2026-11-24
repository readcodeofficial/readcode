package io.syncvault.agent.tls;

import java.io.Closeable;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;

/** One TLS connection to a block store node, speaking a small length-prefixed protocol. */
public final class BlockStoreChannel implements Closeable {

    private static final int READ_TIMEOUT_MS = 30_000;

    private final SSLSocket socket;
    private final DataOutputStream out;
    private final DataInputStream in;

    private BlockStoreChannel(SSLSocket socket) throws IOException {
        this.socket = socket;
        this.out = new DataOutputStream(socket.getOutputStream());
        this.in = new DataInputStream(socket.getInputStream());
    }

    public static BlockStoreChannel open(SSLContext context, String host, int port, Duration connectTimeout)
            throws IOException {
        Socket plain = new Socket();
        try {
            plain.connect(new InetSocketAddress(host, port), (int) connectTimeout.toMillis());
            plain.setSoTimeout(READ_TIMEOUT_MS);

            SSLSocket tls = (SSLSocket) context.getSocketFactory().createSocket(plain, host, port, true);
            SSLParameters params = tls.getSSLParameters();
            params.setProtocols(new String[] {"TLSv1.3", "TLSv1.2"});
            tls.setSSLParameters(params);
            tls.startHandshake();
            return new BlockStoreChannel(tls);
        } catch (IOException | RuntimeException e) {
            plain.close();
            throw e;
        }
    }

    public void uploadBlock(String blockId, byte[] data) throws IOException {
        out.writeUTF(blockId);
        out.writeInt(data.length);
        out.write(data);
        out.flush();

        byte[] ack = new byte[32];
        in.readFully(ack);
        if (!MessageDigest.isEqual(ack, sha256(data))) {
            throw new IOException("block " + blockId + " was acknowledged with a different digest");
        }
    }

    private static byte[] sha256(byte[] data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public String peer() {
        return socket.getInetAddress().getHostName() + ":" + socket.getPort();
    }

    @Override
    public void close() throws IOException {
        socket.close();
    }
}
