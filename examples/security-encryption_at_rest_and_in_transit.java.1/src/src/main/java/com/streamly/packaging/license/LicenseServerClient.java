package com.streamly.packaging.license;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.time.Duration;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.TrustManagerFactory;

public class LicenseServerClient {

    private final HttpClient http;
    private final URI endpoint;

    public LicenseServerClient(URI endpoint, Path clientStore, Path trustStore, char[] password)
            throws GeneralSecurityException, IOException {
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(load(clientStore, password), password);
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(load(trustStore, password));

        SSLContext ssl = SSLContext.getInstance("TLSv1.3");
        ssl.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);

        SSLParameters params = new SSLParameters();
        params.setProtocols(new String[] {"TLSv1.3"});
        params.setEndpointIdentificationAlgorithm("HTTPS");

        this.endpoint = endpoint;
        this.http = HttpClient.newBuilder()
                .sslContext(ssl)
                .sslParameters(params)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public void registerTitle(String titleId, byte[] wrappedKey) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(endpoint.resolve("/v1/titles/" + titleId + "/key"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/octet-stream")
                .PUT(HttpRequest.BodyPublishers.ofByteArray(wrappedKey))
                .build();
        HttpResponse<Void> response = http.send(request, HttpResponse.BodyHandlers.discarding());
        if (response.statusCode() != 204) {
            throw new IOException("License server rejected key for " + titleId + ": " + response.statusCode());
        }
    }

    private static KeyStore load(Path path, char[] password) throws GeneralSecurityException, IOException {
        KeyStore store = KeyStore.getInstance("PKCS12");
        try (var in = Files.newInputStream(path)) {
            store.load(in, password);
        }
        return store;
    }
}
