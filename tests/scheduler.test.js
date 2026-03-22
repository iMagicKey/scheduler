import { describe, it, beforeEach, afterEach } from 'node:test'
import { expect } from 'chai'
import { Scheduler, createScheduler } from '../src/index.js'

describe('Scheduler', () => {
    let scheduler

    beforeEach(() => {
        scheduler = new Scheduler({ tickInterval: 10 })
    })

    afterEach(() => {
        scheduler.stop()
    })

    describe('constructor', () => {
        it('creates scheduler with default options', () => {
            const s = new Scheduler()
            expect(s.isRunning()).to.be.false
        })
        it('createScheduler factory works', () => {
            const s = createScheduler({ tickInterval: 100 })
            expect(s).to.be.instanceOf(Scheduler)
        })
    })

    describe('schedule', () => {
        it('adds a task', () => {
            scheduler.schedule('test', async () => {}, { interval: 100 })
            const status = scheduler.getStatus()
            expect(status.test).to.exist
        })
        it('throws if fn is not a function', () => {
            expect(() => scheduler.schedule('bad', 'not-fn', { interval: 100 })).to.throw(TypeError)
        })
        it('throws if interval is invalid', () => {
            expect(() => scheduler.schedule('bad', async () => {}, { interval: -1 })).to.throw(TypeError)
        })
        it('throws if task name is already registered', () => {
            scheduler.schedule('dup', async () => {}, { interval: 100 })
            expect(() => scheduler.schedule('dup', async () => {}, { interval: 100 })).to.throw(Error)
        })
        it('returns scheduler for chaining', () => {
            const ret = scheduler.schedule('chain', async () => {}, { interval: 100 })
            expect(ret).to.equal(scheduler)
        })
    })

    describe('unschedule', () => {
        it('removes a task', () => {
            scheduler.schedule('rem', async () => {}, { interval: 100 })
            scheduler.unschedule('rem')
            expect(scheduler.getStatus().rem).to.be.undefined
        })
    })

    describe('start / stop', () => {
        it('isRunning changes state', () => {
            expect(scheduler.isRunning()).to.be.false
            scheduler.start()
            expect(scheduler.isRunning()).to.be.true
            scheduler.stop()
            expect(scheduler.isRunning()).to.be.false
        })
        it('start is idempotent', () => {
            scheduler.start()
            scheduler.start()
            expect(scheduler.isRunning()).to.be.true
        })
        it('stop is idempotent', () => {
            scheduler.stop()
            scheduler.stop()
            expect(scheduler.isRunning()).to.be.false
        })
    })

    describe('task execution', () => {
        it('runs task on schedule', async () => {
            let runCount = 0
            scheduler.schedule(
                'counter',
                async () => {
                    runCount++
                },
                { interval: 20, runImmediately: true }
            )
            scheduler.start()
            await new Promise((resolve) => setTimeout(resolve, 50))
            scheduler.stop()
            expect(runCount).to.be.greaterThanOrEqual(1)
        })

        it('respects runImmediately: false', async () => {
            let ran = false
            scheduler.schedule(
                'delayed',
                async () => {
                    ran = true
                },
                { interval: 500, runImmediately: false }
            )
            scheduler.start()
            await new Promise((resolve) => setTimeout(resolve, 30))
            scheduler.stop()
            expect(ran).to.be.false
        })

        it('inProcess guard prevents concurrent execution', async () => {
            let concurrency = 0
            let maxConcurrency = 0
            scheduler.schedule(
                'concurrent',
                async () => {
                    concurrency++
                    maxConcurrency = Math.max(maxConcurrency, concurrency)
                    await new Promise((resolve) => setTimeout(resolve, 100))
                    concurrency--
                },
                { interval: 10, runImmediately: true }
            )
            scheduler.start()
            await new Promise((resolve) => setTimeout(resolve, 80))
            scheduler.stop()
            expect(maxConcurrency).to.equal(1)
        })

        it('calls onError when task throws', async () => {
            let errorCaught = null
            const s = new Scheduler({
                tickInterval: 10,
                onError: (name, err) => {
                    errorCaught = { name, err }
                },
            })
            s.schedule(
                'failing',
                async () => {
                    throw new Error('task error')
                },
                { interval: 10 }
            )
            s.start()
            await new Promise((resolve) => setTimeout(resolve, 40))
            s.stop()
            expect(errorCaught).to.not.be.null
            expect(errorCaught.name).to.equal('failing')
            expect(errorCaught.err.message).to.equal('task error')
        })

        it('calls onTimeout when task exceeds timeout', async () => {
            let timedOut = null
            const s = new Scheduler({
                tickInterval: 10,
                onTimeout: (name) => {
                    timedOut = name
                },
            })
            // Task that never resolves within 30ms timeout
            s.schedule('slow', async () => new Promise((resolve) => setTimeout(resolve, 200)), {
                interval: 10,
                timeout: 30,
                runImmediately: true,
            })
            s.start()
            await new Promise((resolve) => setTimeout(resolve, 60))
            s.stop()
            expect(timedOut).to.equal('slow')
        })
    })

    describe('getStatus', () => {
        it('returns task metadata', () => {
            scheduler.schedule('info', async () => {}, { interval: 500, timeout: 5000 })
            const status = scheduler.getStatus()
            expect(status.info.interval).to.equal(500)
            expect(status.info.timeout).to.equal(5000)
            expect(status.info.inProcess).to.be.false
        })
    })
})
