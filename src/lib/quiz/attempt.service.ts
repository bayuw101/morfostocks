import { prisma } from '@/lib/prisma'

// Only these fields may come from the client
const STUDENT_WRITABLE = ['selectedOptionId', 'essayAnswer'] as const

export const AttemptService = {
    // STUB: Full implementation in next client-side task
    async create(quizId: string, studentId: string, pinCode?: string) {
        throw new Error('NOT_IMPLEMENTED')
    },

    // STUB: Atomic JSON patch preventing race condition
    async saveAnswer(attemptId: string, questionId: string, rawPayload: Record<string, unknown>) {
        const safe: Record<string, unknown> = {}
        for (const key of STUDENT_WRITABLE) {
            if (rawPayload[key] !== undefined) safe[key] = rawPayload[key]
        }

        const result = await prisma.$executeRaw`
      UPDATE student_attempts
      SET
        answers_json     = jsonb_set(
          COALESCE(answers_json, '{"meta":{},"answers":{}}'::jsonb),
          ${`{answers,${questionId}}`},
          ${JSON.stringify(safe)}::jsonb,
          true
        ),
        last_answered_at = NOW()
      WHERE id     = ${attemptId}
        AND status = 'IN_PROGRESS'
    `

        if (result === 0) throw new Error('ATTEMPT_NOT_EDITABLE')
    },

    // STUB: Auto grading
    async autoGrade(attemptId: string) {
        throw new Error('NOT_IMPLEMENTED')
    },

    // Teacher grade essay
    async gradeEssay(attemptId: string, actorId: string, questionId: string, score: number) {
        return prisma.$transaction(async (tx) => {
            const attempt = await tx.studentAttempt.findUniqueOrThrow({
                where: { id: attemptId },
                include: { quiz: { include: { questions: true } } }
            })

            if (attempt.status !== 'NEEDS_GRADING') throw new Error('INVALID_TRANSITION')

            const question = attempt.quiz.questions.find((q) => q.id === questionId)
            if (!question) throw new Error('NOT_FOUND')
            if ((question.questionSnapshot as any).type !== 'ESSAY') throw new Error('VALIDATION_ERROR')

            if (score < 0 || score > question.points) throw new Error('VALIDATION_ERROR')

            const answersJson = attempt.answersJson as any ?? { meta: {}, answers: {} }
            if (!answersJson.answers) answersJson.answers = {}

            answersJson.answers[questionId] = {
                ...(answersJson.answers[questionId] || {}),
                score,
                isCorrect: score > 0,
            }

            const allQuestions = attempt.quiz.questions
            const essayQuestions = allQuestions.filter((q) => (q.questionSnapshot as any).type === 'ESSAY')

            const allGraded = essayQuestions.every(
                (q) => answersJson.answers[q.id]?.score !== null && answersJson.answers[q.id]?.score !== undefined
            )

            if (allGraded) {
                let totalScore = 0
                for (const q of allQuestions) {
                    totalScore += (answersJson.answers[q.id]?.score || 0)
                }
                const maxScore = allQuestions.reduce((sum, q) => sum + q.points, 0)
                const finalScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
                const isPassed = finalScore >= attempt.quiz.passingGrade

                return tx.studentAttempt.update({
                    where: { id: attemptId },
                    data: {
                        answersJson,
                        score: finalScore,
                        isPassed,
                        status: 'GRADED',
                        gradedAt: new Date(),
                        gradedBy: actorId,
                    }
                })
            } else {
                return tx.studentAttempt.update({
                    where: { id: attemptId },
                    data: { answersJson }
                })
            }
        })
    }
}
