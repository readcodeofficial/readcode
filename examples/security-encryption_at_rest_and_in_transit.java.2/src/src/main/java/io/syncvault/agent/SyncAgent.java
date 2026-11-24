package io.syncvault.agent;

import io.syncvault.agent.tls.BlockStoreChannel;
import io.syncvault.agent.tls.TlsContextFactory;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import javax.net.ssl.SSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SyncAgent {

    private static final Logger log = LoggerFactory.getLogger(SyncAgent.class);

    private final SSLContext tls;
    private final HttpClient http;
    private final String blockHost;
    private final int blockPort;

    public SyncAgent(Path identity, Path trust, String blockHost, int blockPort) throws Exception {
        char[] identityPassword = System.getenv("AGENT_IDENTITY_PASSWORD").toCharArray();
        char[] trustPassword = System.getenv("AGENT_TRUST_PASSWORD").toCharArray();
        this.tls = TlsContextFactory.create(identity, identityPassword, trust, trustPassword);
        this.http = HttpClient.newBuilder()
                .sslContext(tls)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.blockHost = blockHost;
        this.blockPort = blockPort;
    }

    public String fetchManifest(URI manifestUri) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(manifestUri).timeout(Duration.ofSeconds(10)).build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("manifest request failed with HTTP " + response.statusCode());
        }
        return response.body();
    }

    public int pushBlocks(Map<String, byte[]> blocks) throws IOException {
        int sent = 0;
        try (BlockStoreChannel channel = BlockStoreChannel.open(tls, blockHost, blockPort, Duration.ofSeconds(5))) {
            for (Map.Entry<String, byte[]> block : blocks.entrySet()) {
                channel.uploadBlock(block.getKey(), block.getValue());
                sent++;
            }
            log.info("uploaded {} blocks to {}", sent, channel.peer());
        }
        return sent;
    }
}
