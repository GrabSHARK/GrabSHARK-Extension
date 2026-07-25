import { getLinkWithHighlights } from './runtime/messages';
import { fetchAuthorizedImageUrl } from './authorizedImageUrl';
import type { LinkWithHighlights } from './types/highlight';

type TimeoutHandle = ReturnType<typeof setTimeout>;
type IntervalHandle = ReturnType<typeof setInterval>;

interface PollSubscriber<T> {
  onValue: (value: T) => void;
  onTimeout?: () => void;
}

interface PollTask<T> {
  subscribers: Set<PollSubscriber<T>>;
  intervalId: IntervalHandle | null;
  timeoutId: TimeoutHandle | null;
  inFlight: boolean;
  stopped: boolean;
}

function stopTask<T>(tasks: Map<string, PollTask<T>>, key: string, task: PollTask<T>) {
  if (task.intervalId) {
    clearInterval(task.intervalId);
    task.intervalId = null;
  }
  if (task.timeoutId) {
    clearTimeout(task.timeoutId);
    task.timeoutId = null;
  }
  task.stopped = true;
  tasks.delete(key);
}

function subscribeWithSharedPolling<T>({
  tasks,
  key,
  intervalMs,
  timeoutMs,
  poll,
  subscriber,
}: {
  tasks: Map<string, PollTask<T>>;
  key: string;
  intervalMs: number;
  timeoutMs: number;
  poll: () => Promise<T | null>;
  subscriber: PollSubscriber<T>;
}) {
  let task = tasks.get(key);

  if (!task) {
    task = {
      subscribers: new Set(),
      intervalId: null,
      timeoutId: null,
      inFlight: false,
      stopped: false,
    };
    tasks.set(key, task);

    const tick = async () => {
      if (task!.stopped || task!.inFlight) {
        return;
      }

      task!.inFlight = true;
      try {
        const value = await poll();
        if (task!.stopped || value == null) {
          return;
        }

        const subscribers = Array.from(task!.subscribers);
        stopTask(tasks, key, task!);
        for (const currentSubscriber of subscribers) {
          currentSubscriber.onValue(value);
        }
      } finally {
        if (!task!.stopped) {
          task!.inFlight = false;
        }
      }
    };

    task.intervalId = setInterval(() => {
      void tick();
    }, intervalMs);

    task.timeoutId = setTimeout(() => {
      if (task!.stopped) {
        return;
      }

      const subscribers = Array.from(task!.subscribers);
      stopTask(tasks, key, task!);
      for (const currentSubscriber of subscribers) {
        currentSubscriber.onTimeout?.();
      }
    }, timeoutMs);

    void tick();
  }

  task.subscribers.add(subscriber);

  return () => {
    const currentTask = tasks.get(key);
    if (!currentTask) {
      return;
    }

    currentTask.subscribers.delete(subscriber);
    if (currentTask.subscribers.size === 0) {
      stopTask(tasks, key, currentTask);
    }
  };
}

const previewTasks = new Map<string, PollTask<LinkWithHighlights>>();
const tagTasks = new Map<string, PollTask<LinkWithHighlights>>();
const archivePreviewTasks = new Map<string, PollTask<string>>();

export function subscribeToLinkPreview(
  linkUrl: string,
  subscriber: PollSubscriber<LinkWithHighlights>,
) {
  return subscribeWithSharedPolling({
    tasks: previewTasks,
    key: linkUrl,
    intervalMs: 2000,
    timeoutMs: 30000,
    subscriber,
    poll: async () => {
      try {
        const response = await getLinkWithHighlights(linkUrl);
        return response?.link?.preview ? response.link : null;
      } catch {
        return null;
      }
    },
  });
}

export function subscribeToLinkTags(
  linkUrl: string,
  subscriber: PollSubscriber<LinkWithHighlights>,
) {
  return subscribeWithSharedPolling({
    tasks: tagTasks,
    key: linkUrl,
    intervalMs: 2000,
    timeoutMs: 30000,
    subscriber,
    poll: async () => {
      try {
        const response = await getLinkWithHighlights(linkUrl);
        return response?.link?.tags?.length ? response.link : null;
      } catch {
        return null;
      }
    },
  });
}

export function subscribeToArchivePreviewImage(
  linkId: number,
  baseUrl: string,
  subscriber: PollSubscriber<string>,
) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const previewUrl = `${normalizedBaseUrl}/api/v1/archives/${linkId}?format=1&preview=true`;

  return subscribeWithSharedPolling({
    tasks: archivePreviewTasks,
    key: previewUrl,
    intervalMs: 3000,
    timeoutMs: 30000,
    subscriber,
    poll: async () => {
      try {
        return await fetchAuthorizedImageUrl(previewUrl);
      } catch {
        return null;
      }
    },
  });
}
