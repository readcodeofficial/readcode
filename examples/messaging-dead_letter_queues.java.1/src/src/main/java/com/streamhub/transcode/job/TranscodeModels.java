package com.streamhub.transcode.job;

public record TranscodeJob(String assetId, String sourceUri, String codec, int targetHeight) {}

record EncodingProfile(String name, String codec, int height, int bitrateKbps) {}

interface TranscoderClient {
    void submit(String assetId, String sourceUri, EncodingProfile profile);
}

class ProfileResolver {
    EncodingProfile resolve(String codec, int height) {
        if (!"h264".equals(codec) && !"av1".equals(codec)) {
            throw new UnsupportedCodecException(codec);
        }
        return new EncodingProfile(codec + "-" + height + "p", codec, height, height * 4);
    }
}

class MalformedJobException extends RuntimeException {
    MalformedJobException(String message) { super(message); }
}

class UnsupportedCodecException extends RuntimeException {
    UnsupportedCodecException(String codec) { super("unsupported codec " + codec); }
}
