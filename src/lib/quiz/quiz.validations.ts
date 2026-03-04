import { prisma } from '@/lib/prisma'
import { QuizCollaboratorRole, QuizStatus, AttemptStatus } from '@prisma/client'

export async function assertCollaboratorRole(
    quizId: string,
    userId: string,
    allowed: QuizCollaboratorRole[]
) {
    const collab = await prisma.quizCollaborator.findUnique({
        where: { quizId_userId: { quizId, userId } },
    })
    if (!collab || !allowed.includes(collab.role)) {
        throw new Error('FORBIDDEN')
    }
    return collab
}

const VALID_QUIZ_TRANSITIONS: Record<QuizStatus, QuizStatus[]> = {
    DRAFT: ['PUBLISHED'],
    PUBLISHED: ['ARCHIVED', 'DRAFT', 'CLOSED'],
    CLOSED: ['DRAFT', 'ARCHIVED'],
    ARCHIVED: [],
}

export function assertQuizTransition(from: QuizStatus, to: QuizStatus) {
    if (!VALID_QUIZ_TRANSITIONS[from].includes(to)) {
        throw new Error(`Invalid quiz transition: ${from} → ${to}`)
    }
}

const VALID_ATTEMPT_TRANSITIONS: Record<AttemptStatus, AttemptStatus[]> = {
    IN_PROGRESS: ['SUBMITTED', 'AUTO_SUBMITTED'],
    SUBMITTED: ['NEEDS_GRADING', 'GRADED'],
    AUTO_SUBMITTED: ['NEEDS_GRADING', 'GRADED'],
    NEEDS_GRADING: ['GRADED'],
    GRADED: [],
}

export function assertAttemptTransition(from: AttemptStatus, to: AttemptStatus) {
    if (!VALID_ATTEMPT_TRANSITIONS[from].includes(to)) {
        throw new Error(`Invalid attempt transition: ${from} → ${to}`)
    }
}
