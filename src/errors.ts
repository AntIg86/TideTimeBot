import type { MessageKey, MessageParams } from './messages';

/** An error whose message is safe to show to the user. */
export class UserError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params: MessageParams = {},
    options?: ErrorOptions,
  ) {
    super(key, options);
    this.name = 'UserError';
  }
}
