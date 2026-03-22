# imagic-scheduler

> Task scheduler with inProcess guard, per-task intervals, and execution timeouts.

## Install

```bash
npm install imagic-scheduler
```

## Quick Start

```js
import Scheduler from 'imagic-scheduler'

const scheduler = new Scheduler({
    onError: (name, err) => console.error(`[${name}] failed:`, err),
    onTimeout: (name) => console.warn(`[${name}] timed out`),
})

scheduler
    .schedule('syncPrices', async () => {
        await fetchAndStorePrices()
    }, { interval: 60_000, timeout: 30_000 })
    .start()
```

## API

### `new Scheduler(options?)`

```ts
new Scheduler(options?: {
    tickInterval?: number
    onError?: (name: string, err: Error) => void
    onTimeout?: (name: string) => void
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tickInterval` | `number` | `1000` | How often (ms) the internal clock checks tasks |
| `onError` | `function` | `console.error` | Called with `(taskName, error)` when a task throws |
| `onTimeout` | `function` | `console.warn` | Called with `(taskName)` when a task exceeds its timeout |

---

### `scheduler.schedule(name, fn, options)`

```ts
scheduler.schedule(
    name: string,
    fn: () => Promise<void>,
    options: {
        interval: number
        timeout?: number
        runImmediately?: boolean
    }
): this
```

Registers a named task for recurring execution.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interval` | `number` | required | How often (ms) to run the task |
| `timeout` | `number` | `10000` | After this many ms, marks the task as not-in-process and calls `onTimeout`; the underlying promise continues (orphaned) |
| `runImmediately` | `boolean` | `true` | If `true`, the first run is scheduled for the next tick; if `false`, the first run is scheduled after `interval` ms |

Returns `this` for chaining.

Throws `Error` if the task name is already registered.
Throws `TypeError` if `fn` is not a function or `interval` is not a positive number.

---

### `scheduler.unschedule(name)`

```ts
scheduler.unschedule(name: string): this
```

Removes a task by name. No-op if the task is not registered. Returns `this`.

---

### `scheduler.start()`

```ts
scheduler.start(): this
```

Starts the internal tick loop. Idempotent — calling `start()` on an already-running scheduler has no effect. Returns `this`.

---

### `scheduler.stop()`

```ts
scheduler.stop(): this
```

Stops the internal tick loop. Idempotent. Does not abort any currently running task. Returns `this`.

---

### `scheduler.isRunning()`

```ts
scheduler.isRunning(): boolean
```

Returns `true` if the scheduler is currently running.

---

### `scheduler.getStatus()`

```ts
scheduler.getStatus(): Record<string, {
    inProcess: boolean
    interval: number
    timeout: number
    nextExecuteTime: number
    runId: number
}>
```

Returns a snapshot of all registered tasks. Each key is a task name.

| Field | Description |
|-------|-------------|
| `inProcess` | `true` if the task is currently executing |
| `interval` | Configured repeat interval in ms |
| `timeout` | Configured execution timeout in ms |
| `nextExecuteTime` | Timestamp (ms) when the task will next run |
| `runId` | Monotonically incrementing counter for the current/last run |

---

### `createScheduler(options?)`

```ts
createScheduler(options?: ConstructorParameters<typeof Scheduler>[0]): Scheduler
```

Factory function — equivalent to `new Scheduler(options)`. Named export for use without `new`.

```js
import { createScheduler } from 'imagic-scheduler'

const scheduler = createScheduler({ tickInterval: 500 })
```

## Error Handling

| Situation | Behavior |
|-----------|----------|
| Task function throws | `onError(name, err)` is called; `inProcess` is cleared; task is not unscheduled |
| Task exceeds `timeout` | `onTimeout(name)` is called; `inProcess` is cleared; the promise continues running (orphaned) |
| Duplicate `name` in `schedule()` | Throws `Error` synchronously |
| `fn` is not a function | Throws `TypeError` synchronously |
| `interval` is not a positive number | Throws `TypeError` synchronously |

Errors in `onError` or `onTimeout` callbacks are not caught — keep them safe.

## Examples

See [`examples/basic.js`](./examples/basic.js) for a runnable demonstration.

```bash
node examples/basic.js
```

## License

MIT
