# AGENT — imagic-scheduler

## Purpose

Runs named recurring async tasks on configurable intervals with an inProcess guard (no overlapping executions per task), per-task execution timeouts, and error isolation.

## Package

- npm: `imagic-scheduler`
- import (local): `import Scheduler, { createScheduler } from '../src/index.js'`
- import (installed): `import Scheduler, { createScheduler } from 'imagic-scheduler'`
- zero runtime deps

## Exports

### `Scheduler` (default export)

```ts
new Scheduler(options?: {
    tickInterval?: number
    onError?: (name: string, err: Error) => void
    onTimeout?: (name: string) => void
})
```

- `tickInterval` {number} [1000] — ms between internal clock ticks; affects precision of `interval` timing
- `onError` {function} [console.error] — called with `(taskName, error)` when a task throws; not called on timeout
- `onTimeout` {function} [console.warn] — called with `(taskName)` when a task exceeds its configured timeout

---

### `scheduler.schedule(name, fn, options): this`

- `name` {string} — unique task identifier
- `fn` {() => Promise<void>} — async task function
- `options.interval` {number} — required; repeat interval in ms; must be a positive finite number
- `options.timeout` {number} [10000] — execution timeout in ms; after expiry, inProcess is cleared and `onTimeout` is called; the promise continues running (orphaned)
- `options.runImmediately` {boolean} [true] — if `true`, first execution is at the next tick; if `false`, first execution is after `interval` ms
- returns: `this`
- throws: `Error` — if `name` is already registered
- throws: `TypeError` — if `fn` is not a function or `interval` is not a positive number

### `scheduler.unschedule(name): this`

- `name` {string} — task to remove
- returns: `this`
- throws: never (no-op if name not found)

### `scheduler.start(): this`

- Starts the tick loop; idempotent
- returns: `this`

### `scheduler.stop(): this`

- Stops the tick loop; idempotent; does not abort running tasks
- returns: `this`

### `scheduler.isRunning(): boolean`

- returns: `true` if the tick loop is active

### `scheduler.getStatus(): Record<string, TaskStatus>`

- returns: snapshot of all registered tasks
- `TaskStatus`: `{ inProcess: boolean, interval: number, timeout: number, nextExecuteTime: number, runId: number }`
- `inProcess` — true when the task is currently executing
- `nextExecuteTime` — Unix ms timestamp of next scheduled run
- `runId` — monotonically incrementing counter (increments on each execution start)

---

### `createScheduler(options?): Scheduler`

Factory function equivalent to `new Scheduler(options)`. Named export.

- `options` — same as `Scheduler` constructor
- returns: `Scheduler` instance

## Usage Patterns

### Basic setup and start

```js
import Scheduler from '../src/index.js'

const scheduler = new Scheduler({
    onError: (name, err) => console.error(`[${name}]`, err),
    onTimeout: (name) => console.warn(`[${name}] timed out`),
})

scheduler
    .schedule('cleanup', async () => { await runCleanup() }, { interval: 30_000 })
    .schedule('healthCheck', async () => { await ping() }, { interval: 5_000, timeout: 3_000 })
    .start()
```

### Delayed first run

```js
scheduler.schedule('report', generateReport, {
    interval: 3_600_000,   // every hour
    timeout: 60_000,
    runImmediately: false, // first run 1 hour from now
})
```

### Dynamic task management

```js
scheduler.schedule('migrate', runMigration, { interval: 60_000 })
// later, after migration is no longer needed:
scheduler.unschedule('migrate')
```

### Factory function

```js
import { createScheduler } from '../src/index.js'

const scheduler = createScheduler({ tickInterval: 500 })
```

### Inspect running state

```js
const status = scheduler.getStatus()
for (const [name, info] of Object.entries(status)) {
    console.log(name, info.inProcess ? 'running' : 'idle', 'next:', new Date(info.nextExecuteTime))
}
```

### Graceful shutdown

```js
process.on('SIGTERM', () => {
    scheduler.stop()
    // in-flight tasks are not aborted; allow them to finish naturally
    process.exit(0)
})
```

## Constraints / Gotchas

- **inProcess guard**: if a task is still executing when its next scheduled time arrives, the tick is skipped for that task. Tasks do not queue up.
- **Timeout orphans**: when a task times out, `inProcess` is cleared and `onTimeout` is called, but the underlying promise keeps running. If that promise later throws, the error is silently swallowed (not routed to `onError`). Keep tasks short or use `AbortController` inside them.
- **tickInterval vs interval**: tasks are checked every `tickInterval` ms. A task with `interval: 1000` and `tickInterval: 1000` may drift. Use a smaller `tickInterval` for higher precision.
- **Duplicate names**: calling `schedule('name', ...)` twice throws synchronously. Call `unschedule` first if you need to replace a task.
- **stop() is not abort()**: stopping the scheduler does not terminate in-flight tasks. The tasks run as unref'd promises.
- **No persistence**: all state is in-memory. Tasks are lost on process restart.
- **Concurrency**: multiple tasks run concurrently; each has its own `inProcess` flag. Only same-named task executions are serialized.
- `onError` and `onTimeout` callbacks must not throw; exceptions inside them are not caught.
