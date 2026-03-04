'use client'

export type ViolationType =
    | 'TAB_SWITCH'
    | 'WINDOW_BLUR'
    | 'FULLSCREEN_EXIT'
    | 'COPY_ATTEMPT'
    | 'CONTEXT_MENU'
    | 'PASTE_ATTEMPT'

export interface ViolationEvent {
    type: ViolationType
    occurredAt: number
    metadata: Record<string, unknown>
}

interface AntiCheatConfig {
    attemptId: string
    quizId: string
    maxViolations: number
    requireFullscreen: boolean
    onViolation: (v: ViolationEvent, count: number) => void
    onLocked: () => void
}

export class AntiCheatManager {
    private attemptId: string
    private quizId: string
    private maxViolations: number
    private requireFullscreen: boolean
    private violationCount: number = 0
    private isLocked: boolean = false
    private onViolation: (v: ViolationEvent, count: number) => void
    private onLocked: () => void
    private tabHiddenAt: number | null = null

    // Bound handlers for proper cleanup
    private boundVisibility: () => void
    private boundBlur: () => void
    private boundFocus: () => void
    private boundFullscreen: () => void
    private boundCopy: (e: Event) => void
    private boundPaste: (e: Event) => void
    private boundContextMenu: (e: Event) => void
    private boundKeydown: (e: Event) => void

    constructor(config: AntiCheatConfig) {
        this.attemptId = config.attemptId
        this.quizId = config.quizId
        this.maxViolations = config.maxViolations
        this.requireFullscreen = config.requireFullscreen
        this.onViolation = config.onViolation
        this.onLocked = config.onLocked

        this.boundVisibility = this.handleVisibilityChange.bind(this)
        this.boundBlur = this.handleWindowBlur.bind(this)
        this.boundFocus = this.handleWindowFocus.bind(this)
        this.boundFullscreen = this.handleFullscreenChange.bind(this)
        this.boundCopy = this.handleCopy.bind(this)
        this.boundPaste = this.handlePaste.bind(this)
        this.boundContextMenu = this.handleContextMenu.bind(this)
        this.boundKeydown = this.handleKeydown.bind(this)
    }

    init() {
        document.addEventListener('visibilitychange', this.boundVisibility)
        window.addEventListener('blur', this.boundBlur)
        window.addEventListener('focus', this.boundFocus)
        document.addEventListener('fullscreenchange', this.boundFullscreen)
        document.addEventListener('webkitfullscreenchange', this.boundFullscreen)
        document.addEventListener('copy', this.boundCopy)
        document.addEventListener('cut', this.boundCopy)
        document.addEventListener('paste', this.boundPaste)
        document.addEventListener('contextmenu', this.boundContextMenu)
        document.addEventListener('keydown', this.boundKeydown)

        if (this.requireFullscreen) {
            this.requestFullscreen()
        }
    }

    private handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this.tabHiddenAt = Date.now()
        } else if (document.visibilityState === 'visible' && this.tabHiddenAt) {
            const duration = Date.now() - this.tabHiddenAt
            this.tabHiddenAt = null
            if (duration > 1000) {
                this.recordViolation('TAB_SWITCH', { durationMs: duration })
            }
        }
    }

    private handleWindowBlur() {
        this.tabHiddenAt = Date.now()
    }

    private handleWindowFocus() {
        if (this.tabHiddenAt) {
            const duration = Date.now() - this.tabHiddenAt
            this.tabHiddenAt = null
            if (duration > 1000) {
                this.recordViolation('WINDOW_BLUR', { durationMs: duration })
            }
        }
    }

    private handleFullscreenChange() {
        const isFullscreen = !!(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement
        )
        if (!isFullscreen && !this.isLocked && this.requireFullscreen) {
            this.recordViolation('FULLSCREEN_EXIT', {})
            setTimeout(() => this.requestFullscreen(), 2000)
        }
    }

    private handleCopy(e: Event) {
        e.preventDefault()
        const selected = window.getSelection()?.toString() ?? ''
        this.recordViolation('COPY_ATTEMPT', {
            textLength: selected.length,
            preview: selected.substring(0, 50),
        })
    }

    private handlePaste(e: Event) {
        const target = e.target as HTMLElement
        // Allow paste in essay text areas
        if (target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        this.recordViolation('PASTE_ATTEMPT', {})
    }

    private handleContextMenu(e: Event) {
        e.preventDefault()
        this.recordViolation('CONTEXT_MENU', {
            x: (e as MouseEvent).clientX,
            y: (e as MouseEvent).clientY,
        })
    }

    private handleKeydown(e: Event) {
        const ke = e as KeyboardEvent
        // Block common shortcuts (soft deterrent, no violation recorded)
        if (
            (ke.ctrlKey && ['c', 'u', 's', 'p'].includes(ke.key.toLowerCase())) ||
            ke.key === 'F12' ||
            (ke.ctrlKey && ke.shiftKey && ke.key === 'I') ||
            (ke.ctrlKey && ke.shiftKey && ke.key === 'J')
        ) {
            ke.preventDefault()
        }
    }

    async requestFullscreen() {
        try {
            await document.documentElement.requestFullscreen()
        } catch { /* User rejected — don't block */ }
    }

    private async recordViolation(type: ViolationType, metadata: Record<string, unknown>) {
        if (this.isLocked) return

        this.violationCount++
        const event: ViolationEvent = { type, occurredAt: Date.now(), metadata }

        this.onViolation(event, this.violationCount)

        // Send to server (best effort)
        try {
            await fetch(`/api/quizzes/${this.quizId}/attempts/${this.attemptId}/violations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, metadata }),
            })
        } catch {
            // Store locally for later sync
            const { QuizStorage } = await import('./quiz-storage')
            await QuizStorage.saveViolation(this.attemptId, event)
        }

        if (this.violationCount >= this.maxViolations) {
            this.lockScreen()
        }
    }

    private async lockScreen() {
        this.isLocked = true
        try {
            await fetch(`/api/quizzes/${this.quizId}/attempts/${this.attemptId}/lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'MAX_VIOLATIONS_EXCEEDED' }),
            })
        } catch { /* best effort */ }
        this.onLocked()
    }

    getViolationCount() {
        return this.violationCount
    }

    getIsLocked() {
        return this.isLocked
    }

    destroy() {
        document.removeEventListener('visibilitychange', this.boundVisibility)
        window.removeEventListener('blur', this.boundBlur)
        window.removeEventListener('focus', this.boundFocus)
        document.removeEventListener('fullscreenchange', this.boundFullscreen)
        document.removeEventListener('webkitfullscreenchange', this.boundFullscreen)
        document.removeEventListener('copy', this.boundCopy)
        document.removeEventListener('cut', this.boundCopy)
        document.removeEventListener('paste', this.boundPaste)
        document.removeEventListener('contextmenu', this.boundContextMenu)
        document.removeEventListener('keydown', this.boundKeydown)
    }
}
