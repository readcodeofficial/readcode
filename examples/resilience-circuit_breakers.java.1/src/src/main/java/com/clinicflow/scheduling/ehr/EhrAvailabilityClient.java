package com.clinicflow.scheduling.ehr;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

public class EhrAvailabilityClient {

    private final HttpClient http;
    private final ObjectMapper mapper;
    private final URI baseUri;

    public EhrAvailabilityClient(HttpClient http, ObjectMapper mapper, URI baseUri) {
        this.http = http;
        this.mapper = mapper;
        this.baseUri = baseUri;
    }

    public List<Slot> fetchSlots(String clinicId, LocalDate day) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(baseUri.resolve("/clinics/" + clinicId + "/slots?date=" + day))
                .timeout(Duration.ofSeconds(3))
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        int status = response.statusCode();
        if (status == 404) {
            throw new UnknownClinicException(clinicId);
        }
        if (status >= 500) {
            throw new EhrServerException("EHR returned " + status);
        }
        return mapper.readValue(response.body(), new TypeReference<List<Slot>>() { });
    }
}
