/** E2E instrumentation on `window` — see `tests/e2e/bots/chat-control.spec.ts` */
declare global {
  interface Window {
    __chatControlPlayCount?: number;
    __chatControlAudioPatched?: boolean;
    GostayloPushPolicy?: {
      shouldSuppressSystemNotificationForNewMessage?: (
        windows: Array<{ url: string; visibilityState: string }>,
        pageOrigin: string,
      ) => boolean;
    };
  }
}

export {};
