/**
 * Server-to-client events. Services publish through this interface so they do not
 * depend on Socket.IO directly (and tests can use a no-op/recording version).
 */
export interface RealtimePublisher {
  toUser(userId: string, event: string, payload: unknown): void;
  toBooking(bookingId: string, event: string, payload: unknown): void;
  /** Close every live socket of a user (account disabled or deleted). */
  disconnectUser(userId: string): void;
}

export class RecordingPublisher implements RealtimePublisher {
  readonly events: { room: string; event: string; payload: unknown }[] = [];
  toUser(userId: string, event: string, payload: unknown) {
    this.events.push({ room: `user:${userId}`, event, payload });
  }
  toBooking(bookingId: string, event: string, payload: unknown) {
    this.events.push({ room: `booking:${bookingId}`, event, payload });
  }
  disconnectUser(userId: string) {
    this.events.push({ room: `user:${userId}`, event: 'disconnect', payload: null });
  }
}
