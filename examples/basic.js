import Scheduler from '../src/index.js'

const scheduler = new Scheduler({
    tickInterval: 1000,
    onError: (name, err) => console.error(`[${name}] Error:`, err.message),
    onTimeout: (name) => console.warn(`[${name}] Execution timeout`),
})

let count = 0
scheduler.schedule(
    'heartbeat',
    async () => {
        count++
        console.log(`Heartbeat #${count} at`, new Date().toISOString())
        if (count >= 3) {
            console.log('Stopping scheduler...')
            scheduler.stop()
        }
    },
    { interval: 1000, timeout: 5000, runImmediately: true }
)

scheduler.schedule(
    'cleanup',
    async () => {
        console.log('Running cleanup task')
    },
    { interval: 5000, runImmediately: false }
)

scheduler.start()
console.log('Scheduler started. Status:', scheduler.getStatus())
