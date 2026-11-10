// Delay dispatch until after mounting so StrictMode's setup/cleanup probe
// cannot submit an abandoned request. Disposing also aborts managed jobs.
export function startSectionSearch<T>(options: {
    run: (signal: AbortSignal) => Promise<T>;
    onStart: () => void;
    onResult: (value: T) => void;
    onError: (error: unknown) => void;
}) {
    const controller = new AbortController();
    queueMicrotask(async () => {
        if (controller.signal.aborted) return;
        options.onStart();
        try {
            const value = await options.run(controller.signal);
            if (!controller.signal.aborted) options.onResult(value);
        } catch (error) {
            if (!controller.signal.aborted) options.onError(error);
        }
    });
    return () => controller.abort();
}
