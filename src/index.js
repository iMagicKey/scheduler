const DEFAULT_TASK_TIMEOUT = 10_000
const DEFAULT_TICK_INTERVAL = 1_000

export class Scheduler {
    #tasks = {}
    #intervalId = null
    #tickInterval
    #onError
    #onTimeout

    constructor({ tickInterval = DEFAULT_TICK_INTERVAL, onError, onTimeout } = {}) {
        this.#tickInterval = tickInterval
        this.#onError = typeof onError === 'function' ? onError : (name, err) => console.error(`[Scheduler] Error in task "${name}":`, err)
        this.#onTimeout = typeof onTimeout === 'function' ? onTimeout : (name) => console.warn(`[Scheduler] Timeout in task "${name}"`)
    }

    schedule(name, fn, { interval, timeout = DEFAULT_TASK_TIMEOUT, runImmediately = true } = {}) {
        if (typeof fn !== 'function') throw new TypeError(`Task "${name}" fn must be a function`)
        if (!Number.isFinite(interval) || interval <= 0) throw new TypeError(`Task "${name}" interval must be a positive number`)
        if (name in this.#tasks) throw new Error(`Task "${name}" is already scheduled`)

        this.#tasks[name] = {
            fn,
            interval,
            timeout,
            inProcess: false,
            runId: 0,
            nextExecuteTime: runImmediately ? 0 : Date.now() + interval,
        }
        return this
    }

    unschedule(name) {
        delete this.#tasks[name]
        return this
    }

    start() {
        if (this.#intervalId !== null) return this
        this.#intervalId = setInterval(() => this.#tick(), this.#tickInterval)
        return this
    }

    stop() {
        if (this.#intervalId !== null) {
            clearInterval(this.#intervalId)
            this.#intervalId = null
        }
        return this
    }

    isRunning() {
        return this.#intervalId !== null
    }

    getStatus() {
        const status = {}
        for (const [name, task] of Object.entries(this.#tasks)) {
            status[name] = {
                inProcess: task.inProcess,
                interval: task.interval,
                timeout: task.timeout,
                nextExecuteTime: task.nextExecuteTime,
                runId: task.runId,
            }
        }
        return status
    }

    #tick() {
        const now = Date.now()
        for (const [name, task] of Object.entries(this.#tasks)) {
            if (now >= task.nextExecuteTime && !task.inProcess) {
                task.nextExecuteTime = now + task.interval
                task.inProcess = true
                task.runId += 1
                const runId = task.runId

                const timeoutId = setTimeout(() => {
                    const t = this.#tasks[name]
                    if (!t || t.runId !== runId || !t.inProcess) return
                    t.inProcess = false
                    this.#onTimeout(name)
                }, task.timeout)

                Promise.resolve()
                    .then(() => task.fn())
                    .then(() => {
                        clearTimeout(timeoutId)
                        const t = this.#tasks[name]
                        if (t && t.runId === runId) t.inProcess = false
                    })
                    .catch((err) => {
                        clearTimeout(timeoutId)
                        const t = this.#tasks[name]
                        if (t && t.runId === runId) t.inProcess = false
                        this.#onError(name, err)
                    })
            }
        }
    }
}

export function createScheduler(options) {
    return new Scheduler(options)
}

export default Scheduler
