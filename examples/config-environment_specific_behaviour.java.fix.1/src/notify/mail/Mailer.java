package notify.mail;

import java.util.ArrayList;
import java.util.List;

public interface Mailer {

    record Message(String from, String to, String subject, String body) {}

    void send(Message message);

    final class Recording implements Mailer {
        private final List<Message> sent = new ArrayList<>();

        @Override
        public void send(Message message) {
            sent.add(message);
        }

        public List<Message> sent() {
            return List.copyOf(sent);
        }
    }
}
