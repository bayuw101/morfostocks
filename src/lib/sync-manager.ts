'use client'

import { QuizStorage } from './quiz-storage'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class SyncManager {
    private attemptId: string
    private quizId: string
    private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
    private retryTimeout: ReturnType<typeof setTimeout> | null = null
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null
    private boundOnline: () => void
    private boundOffline: () => void

    constructor(attemptId: string, quizId: string) {
        this.attemptId = attemptId
        this.quizId = quizId
        this.boundOnline = () => this.onReconnect()
        this.boundOffline = () => this.onDisconnect()

        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.boundOnline)
            window.addEventListener('offline', this.boundOffline)
        }
    }

    /** Called every time student answers a question */
    async queueAnswer(questionId: string, answer: object) {
        // 1. Save locally first (never fails)
        await QuizStorage.saveAnswer(this.attemptId, questionId, answer)

        // 2. Try server sync if online
        if (this.isOnline) {
            await this.syncSingle(questionId, answer)
        }
    }

    private async syncSingle(questionId: string, answer: object) {
        try {
            const res = await fetch(`/api/quizzes/${this.quizId}/attempts/${this.attemptId}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId, answer }),
            })
            if (res.ok) {
                await QuizStorage.markSynced(this.attemptId, questionId)
            } else if (res.status >= 500) {
                // Only retry on server errors (5xx), not auth errors (4xx)
                this.scheduleRetry()
            }
            // 4xx errors (403, 401, etc.) = permanent failures, don't retry
        } catch {
            // Network error — retry
            this.scheduleRetry()
        }
    }

    /** Sync all unsynced answers (bulk) */
    async syncAll(): Promise<number> {
        const unsynced = await QuizStorage.getUnsyncedAnswers(this.attemptId)
        if (unsynced.length === 0) return 0

        let synced = 0
        for (const item of unsynced) {
            await this.syncSingle(item.questionId, item.answer)
            synced++
            await sleep(100) // throttle
        }
        return synced
    }

    private scheduleRetry() {
        if (this.retryTimeout) return
        this.retryTimeout = setTimeout(async () => {
            this.retryTimeout = null
            if (this.isOnline) await this.syncAll()
        }, 3000)
    }

    private async onDisconnect() {
        this.isOnline = false
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('quiz:offline'))
        }
        // Best-effort notify server
        try {
            await fetch(`/api/quizzes/${this.quizId}/attempts/${this.attemptId}/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'disconnected' }),
                keepalive: true,
            })
        } catch { /* expected to fail if truly offline */ }
    }

    private async onReconnect() {
        this.isOnline = true
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('quiz:online'))
        }
        // Sync all pending answers
        await this.syncAll()
        // Notify server of reconnection
        try {
            await fetch(`/api/quizzes/${this.quizId}/attempts/${this.attemptId}/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'reconnected' }),
            })
        } catch { /* ignore */ }
    }

    /** Start 30s heartbeat interval */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            if (!this.isOnline) return
            try {
                const res = await fetch(`/api/quizzes/${this.quizId}/attempts/${this.attemptId}/heartbeat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'active' }),
                })
                if (!res.ok) this.onDisconnect()
            } catch {
                this.onDisconnect()
            }
        }, 30_000)
    }

    getOnlineStatus() {
        return this.isOnline
    }

    destroy() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
        if (this.retryTimeout) clearTimeout(this.retryTimeout)
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.boundOnline)
            window.removeEventListener('offline', this.boundOffline)
        }
    }
}
