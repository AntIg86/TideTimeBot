import type { MessageKey, MessageParams } from './i18n';

/** An error whose (localized) message is safe to show to the user. */
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
