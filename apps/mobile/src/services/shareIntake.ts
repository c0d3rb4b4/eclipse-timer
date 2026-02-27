export type IncomingExternalLink = {
  source: "linking" | "share";
  value: string;
};

export type IncomingExternalLinkListener = (link: IncomingExternalLink) => void;

type LinkingUrlEvent = {
  url: string;
};

type IntakeSubscription = {
  remove: () => void;
};

export type LinkingLike = {
  addEventListener: (
    eventType: "url",
    listener: (event: LinkingUrlEvent) => void,
  ) => IntakeSubscription;
  getInitialURL: () => Promise<string | null>;
};

export type SubscribeShareExternalLinks = (
  listener: IncomingExternalLinkListener,
) => (() => void) | undefined;

export type ShareIntakeOptions = {
  linking?: LinkingLike;
  subscribeShareExternalLinks?: SubscribeShareExternalLinks;
};

export function toIncomingExternalLink(
  source: IncomingExternalLink["source"],
  value: unknown,
): IncomingExternalLink | null {
  if (typeof value !== "string") return null;
  const normalizedValue = value.trim();
  if (!normalizedValue) return null;
  return { source, value: normalizedValue };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeSharePayloadToIncomingLinks(payload: unknown): IncomingExternalLink[] {
  const collectedValues: string[] = [];
  const seen = new Set<string>();

  const maybeAdd = (candidate: unknown) => {
    const next = toIncomingExternalLink("share", candidate);
    if (!next || seen.has(next.value)) return;
    seen.add(next.value);
    collectedValues.push(next.value);
  };

  if (typeof payload === "string") {
    maybeAdd(payload);
  } else if (Array.isArray(payload)) {
    for (const item of payload) {
      maybeAdd(item);
    }
  } else if (isRecord(payload)) {
    maybeAdd(payload.url);
    maybeAdd(payload.webUrl);
    maybeAdd(payload.text);
    maybeAdd(payload.value);
  }

  return collectedValues.map((value) => ({ source: "share", value }));
}

export function subscribeToLinkingExternalLinks(
  listener: IncomingExternalLinkListener,
  options: ShareIntakeOptions = {},
): () => void {
  const linking = options.linking;
  if (!linking) {
    return () => {};
  }
  let isActive = true;

  const emit = (value: unknown) => {
    const next = toIncomingExternalLink("linking", value);
    if (!next) return;
    listener(next);
  };

  const subscription = linking.addEventListener("url", ({ url }) => {
    if (!isActive) return;
    emit(url);
  });

  void linking
    .getInitialURL()
    .then((url) => {
      if (!isActive) return;
      emit(url);
    })
    .catch(() => {
      // Ignore initial URL read failures and keep runtime listeners alive.
    });

  return () => {
    isActive = false;
    subscription.remove();
  };
}

export function subscribeToIncomingExternalLinks(
  listener: IncomingExternalLinkListener,
  options: ShareIntakeOptions = {},
): () => void {
  const unsubscribers: Array<() => void> = [];

  unsubscribers.push(subscribeToLinkingExternalLinks(listener, options));

  if (options.subscribeShareExternalLinks) {
    const unsubscribeShare = options.subscribeShareExternalLinks(listener);
    if (typeof unsubscribeShare === "function") {
      unsubscribers.push(unsubscribeShare);
    }
  }

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}
