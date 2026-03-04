'use client'

import { openDB, type IDBPDatabase } from 'idb'

export interface LocalAnswer {
    questionId: string
    answer: { selectedOptionId?: string; essayAnswer?: string }
    savedAt: number
    synced: boolean
}

export interface LocalAttempt {
    attemptId: string
    quizId: string
    answers: Record<string, LocalAnswer>
    lastSyncAt: number
    startedAt: number
}

interface ViolationRecord {
    type: string
    occurredAt: number
    metadata: Record<string, unknown>
    synced: boolean
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB('quiz-offline', 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('attempts')) {
                    db.createObjectStore('attempts', { keyPath: 'attemptId' })
                }
                if (!db.objectStoreNames.contains('violations')) {
                    db.createObjectStore('violations', { keyPath: 'id', autoIncrement: true })
                }
            },
        })
    }
    return dbPromise
}

export const QuizStorage = {
    /** Save a single answer locally (instant, never fails) */
    async saveAnswer(attemptId: string, questionId: string, answer: object) {
        const db = await getDB()
        const existing = await db.get('attempts', attemptId)
        const attempt: LocalAttempt = existing ?? {
            attemptId,
            quizId: '',
            answers: {},
            lastSyncAt: 0,
            startedAt: Date.now(),
        }
        attempt.answers[questionId] = {
            questionId,
            answer: answer as any,
            savedAt: Date.now(),
            synced: false,
        }
        await db.put('attempts', attempt)
    },

    /** Mark a specific answer as synced to server */
    async markSynced(attemptId: string, questionId: string) {
        const db = await getDB()
        const attempt = await db.get('attempts', attemptId)
        if (attempt?.answers[questionId]) {
            attempt.answers[questionId].synced = true
            attempt.lastSyncAt = Date.now()
            await db.put('attempts', attempt)
        }
    },

    /** Get all answers not yet synced to server */
    async getUnsyncedAnswers(attemptId: string): Promise<LocalAnswer[]> {
        const db = await getDB()
        const attempt = await db.get('attempts', attemptId)
        if (!attempt) return []
        return (Object.values(attempt.answers) as LocalAnswer[]).filter((a) => !a.synced)
    },

    /** Get all answers (for bulk submit) */
    async getAllAnswers(attemptId: string): Promise<Record<string, LocalAnswer>> {
        const db = await getDB()
        const attempt = await db.get('attempts', attemptId)
        return (attempt?.answers || {}) as Record<string, LocalAnswer>
    },

    /** Save a violation event locally (for offline sync) */
    async saveViolation(attemptId: string, event: { type: string; occurredAt: number; metadata: Record<string, unknown> }) {
        const db = await getDB()
        const record: ViolationRecord = { ...event, synced: false }
        await db.add('violations', { attemptId, ...record })
    },

    /** Clean up after quiz is done */
    async clearAttempt(attemptId: string) {
        const db = await getDB()
        await db.delete('attempts', attemptId)
    },
}
