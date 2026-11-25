package notify.config;

import java.util.Map;

public record AppConfig(String environment, String sandboxRecipient, String fromAddress) {

    private static final String DEFAULT_ENVIRONMENT = "development";

    public static AppConfig fromEnv(Map<String, String> env) {
        String name = env.getOrDefault("APP_ENV", DEFAULT_ENVIRONMENT).trim().toLowerCase();
        if (name.isEmpty()) {
            name = DEFAULT_ENVIRONMENT;
        }
        String sandbox = env.getOrDefault("MAIL_SANDBOX_RECIPIENT", "mail-sink@example.test");
        String from = env.getOrDefault("MAIL_FROM", "no-reply@example.test");
        return new AppConfig(name, sandbox, from);
    }
}
