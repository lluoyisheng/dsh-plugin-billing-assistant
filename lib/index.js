/**
 * Host loader entry for 计费助手 (billing assistant), a browser-only plugin.
 *
 * All behavior lives in the client half (`./client`): this package only needs a
 * valid host plugin so @deepseek-ai/dsh-client-modules can resolve the package,
 * read its `dsh.client` declaration, and serve `lib/client.js`.
 */

/** Provides no host-side behavior. */
export function apply() {}
