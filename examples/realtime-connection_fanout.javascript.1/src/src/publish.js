export async function publishSessionEvent(publisher, event) {
  if (!event.userId || !event.type) {
    throw new TypeError("session event needs userId and type");
  }
  await publisher.publish("session-events", JSON.stringify(event));
}
