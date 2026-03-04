import { prisma } from '@/lib/prisma'
import { QuizStatus, QuizCollaboratorRole } from '@prisma/client'
import { assertCollaboratorRole, assertQuizTransition } from './quiz.validations'
import { CreateQuizInput, UpdateQuizInput, AddQuizQuestionInput, UpdateQuizQuestionInput } from './quiz.types'

export const QuizService = {
    async listForUser(userId: string, filters: { subjectId?: string; status?: string }) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { studentRecord: { select: { classId: true } } },
        })
        if (!user) throw new Error('NOT_FOUND')

        const isAdmin = user.role === 'ADMIN'
        const isStudent = user.role === 'STUDENT'
        const studentClassId = user.studentRecord?.classId

        const studentOrConditions: any[] = [
            { accessMode: 'SPECIFIC_STUDENTS', studentAccess: { some: { studentId: userId } } },
        ]
        if (studentClassId) {
            studentOrConditions.push({
                accessMode: { in: ['ALL_CLASSES', 'SPECIFIC_CLASSES'] },
                classAccess: { some: { classId: studentClassId } }
            })
        }

        let statusFilter: any = 'PUBLISHED'
        if (filters.status) {
            if (filters.status.includes(',')) {
                statusFilter = { in: filters.status.split(',') as QuizStatus[] }
            } else {
                statusFilter = filters.status as QuizStatus
            }
        }

        // Students see quizzes accessible to their class or themselves
        const roleFilter = isAdmin
            ? {}
            : isStudent
                ? {
                    status: statusFilter,
                    OR: studentOrConditions
                }
                : { collaborators: { some: { userId, acceptedAt: { not: null } } } }

        const quizzes = await prisma.quiz.findMany({
            where: {
                ...roleFilter,
                ...(filters.subjectId && { subjectId: filters.subjectId }),
                ...(!isStudent && filters.status && { status: statusFilter }),
            },
            include: {
                subject: true,
                ...(!isStudent && { collaborators: true }),
                classAccess: isStudent ? (studentClassId ? { where: { classId: studentClassId } } : false) : true,
                studentAccess: isStudent ? { where: { studentId: userId } } : true,
                _count: {
                    select: {
                        questions: true,
                        attempts: isStudent ? { where: { studentId: userId } } : true
                    }
                },
                attempts: isStudent ? {
                    where: { studentId: userId },
                    orderBy: [{ startedAt: 'desc' }],
                    select: {
                        id: true,
                        score: true,
                        status: true,
                        startedAt: true,
                        submittedAt: true,
                        gradedAt: true,
                    }
                } : false,
            },
            orderBy: { createdAt: 'desc' },
        })

        if (isStudent) {
            return quizzes.map((q: any) => {
                let isAccessible = false
                if (q.accessMode === 'SPECIFIC_STUDENTS') {
                    isAccessible = q.studentAccess?.[0]?.isOpen ?? false
                } else {
                    isAccessible = q.classAccess?.[0]?.isOpen ?? false
                }

                const { classAccess, studentAccess, attempts, ...rest } = q

                // For student lists, we also want to expose how many attempts they've made
                const userAttemptCount = q._count?.attempts || 0

                let highestScore: number | null = null;
                if (attempts && attempts.length > 0) {
                    const gradedAttempts = attempts.filter((a: any) => a.score !== null)
                    if (gradedAttempts.length > 0) {
                        highestScore = Math.max(...gradedAttempts.map((a: any) => a.score))
                    }
                }

                const latestAttempt = attempts?.[0]

                return {
                    ...rest,
                    isAccessible,
                    userAttemptCount,
                    highestScore,
                    latestAttemptId: latestAttempt?.id ?? null,
                    latestAttemptStatus: latestAttempt?.status ?? null,
                }
            })
        }

        return quizzes
    },

    async create(userId: string, data: CreateQuizInput) {
        if (!data.title || data.title.trim() === '') throw new Error('VALIDATION_ERROR')
        if (data.durationMinutes <= 0) throw new Error('VALIDATION_ERROR')
        if (data.passingGrade != null && (data.passingGrade < 1 || data.passingGrade > 100)) throw new Error('VALIDATION_ERROR')
        if (data.maxRetake !== undefined && data.maxRetake <= 0) throw new Error('VALIDATION_ERROR')
        if (data.questionsPerAttempt !== undefined && data.questionsPerAttempt <= 0) throw new Error('VALIDATION_ERROR')

        return prisma.$transaction(async (tx) => {
            const quiz = await tx.quiz.create({
                data: {
                    title: data.title,
                    description: data.description,
                    subjectId: data.subjectId,
                    durationMinutes: data.durationMinutes,
                    passingGrade: data.passingGrade ?? 75,
                    autoReleaseScore: data.autoReleaseScore ?? true,
                    allowRetake: data.allowRetake ?? false,
                    maxRetake: data.allowRetake ? (data.maxRetake ?? null) : null,
                    pinCode: data.pinCode ?? null,
                    accessMode: data.accessMode ?? 'ALL_CLASSES',
                    randomizeQuestions: data.randomizeQuestions ?? false,
                    randomizeOptions: data.randomizeOptions ?? false,
                    questionsPerAttempt: data.questionsPerAttempt ?? null,
                    showQuestionNumbers: data.showQuestionNumbers ?? true,
                    allowBackNavigation: data.allowBackNavigation ?? true,
                    antiCheatEnabled: data.antiCheatEnabled ?? true,
                    maxViolations: data.maxViolations ?? 3,
                    requireFullscreen: data.requireFullscreen ?? true,
                    disconnectGraceMinutes: data.disconnectGraceMinutes ?? 5,
                    status: 'DRAFT',
                },
            })

            // Auto-assign creator as OWNER
            await tx.quizCollaborator.create({
                data: {
                    quizId: quiz.id,
                    userId,
                    role: 'OWNER',
                    invitedBy: userId,
                    acceptedAt: new Date(),
                },
            })

            return quiz
        })
    },

    async update(quizId: string, actorId: string, data: UpdateQuizInput) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER', 'EDITOR'])
        const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } }).catch(() => { throw new Error('NOT_FOUND') })

        const DRAFT_ONLY_FIELDS = [
            'title', 'description', 'durationMinutes', 'passingGrade',
            'autoReleaseScore', 'allowRetake', 'maxRetake',
            'randomizeQuestions', 'randomizeOptions', 'questionsPerAttempt',
        ]

        if (quiz.status !== 'DRAFT') {
            const illegalFields = DRAFT_ONLY_FIELDS.filter(f => f in data)
            if (illegalFields.length > 0) {
                throw new Error(`VALIDATION_ERROR: Cannot change ${illegalFields.join(', ')} on ${quiz.status} quiz`)
            }
        }

        if (quiz.status === 'ARCHIVED') {
            throw new Error('VALIDATION_ERROR')
        }

        return prisma.quiz.update({ where: { id: quizId }, data: data as any })
    },

    async inviteCollaborator(quizId: string, actorId: string, targetUserId: string, role: string) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER'])

        if (targetUserId === actorId) throw new Error('VALIDATION_ERROR')
        if (role === 'OWNER') throw new Error('VALIDATION_ERROR')

        const existingCollab = await prisma.quizCollaborator.findUnique({
            where: { quizId_userId: { quizId, userId: targetUserId } }
        })
        if (existingCollab) throw new Error('VALIDATION_ERROR')

        const user = await prisma.user.findUnique({ where: { id: targetUserId } })
        if (!user) throw new Error('NOT_FOUND')
        if (user.role === 'STUDENT') throw new Error('VALIDATION_ERROR')

        return prisma.quizCollaborator.create({
            data: {
                quizId,
                userId: targetUserId,
                role: role as QuizCollaboratorRole,
                invitedBy: actorId,
                acceptedAt: null,
            }
        })
    },

    async acceptInvitation(quizId: string, actorId: string) {
        const collab = await prisma.quizCollaborator.findUnique({
            where: { quizId_userId: { quizId, userId: actorId } }
        })
        if (!collab) throw new Error('NOT_FOUND')
        if (collab.acceptedAt) throw new Error('VALIDATION_ERROR')

        return prisma.quizCollaborator.update({
            where: { id: collab.id },
            data: { acceptedAt: new Date() }
        })
    },

    async publish(quizId: string, actorId: string) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER'])

        const quiz = await prisma.quiz.findUniqueOrThrow({
            where: { id: quizId },
            include: { questions: true },
        }).catch(() => { throw new Error('NOT_FOUND') })

        assertQuizTransition(quiz.status, 'PUBLISHED')

        if (quiz.questions.length === 0) {
            throw new Error('VALIDATION_ERROR: Quiz must have at least one question before publishing')
        }

        if (quiz.questionsPerAttempt !== null && quiz.questionsPerAttempt > quiz.questions.length) {
            throw new Error(`VALIDATION_ERROR: questionsPerAttempt (${quiz.questionsPerAttempt}) exceeds total questions (${quiz.questions.length}). Add more questions or reduce questionsPerAttempt.`)
        }

        const hasEssay = quiz.questions.some(
            (q) => (q.questionSnapshot as any)?.type === 'ESSAY'
        )

        const now = new Date()

        const updatedQuiz = await prisma.quiz.update({
            where: { id: quizId },
            data: {
                status: 'PUBLISHED',
                publishedAt: now,
                autoReleaseScore: hasEssay ? false : quiz.autoReleaseScore,
            },
        })

        return { quiz: updatedQuiz, warning: hasEssay ? "autoReleaseScore was disabled because essay questions exist" : undefined }
    },

    async unpublish(quizId: string, actorId: string) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER'])

        const quiz = await prisma.quiz.findUniqueOrThrow({
            where: { id: quizId },
        }).catch(() => { throw new Error('NOT_FOUND') })

        assertQuizTransition(quiz.status, 'DRAFT')

        const inProgressCount = await prisma.studentAttempt.count({
            where: { quizId, status: 'IN_PROGRESS' }
        })

        if (inProgressCount > 0) {
            throw new Error('VALIDATION_ERROR: Cannot unpublish quiz with active attempts')
        }

        const updatedQuiz = await prisma.quiz.update({
            where: { id: quizId },
            data: {
                status: 'DRAFT',
            },
        })

        return { quiz: updatedQuiz }
    },

    async extendTime(quizId: string, actorId: string, addedMinutes: number, reason?: string) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER', 'EDITOR'])

        if (addedMinutes <= 0) throw new Error('VALIDATION_ERROR')

        return prisma.$transaction(async (tx) => {
            const quiz = await tx.quiz.findUniqueOrThrow({ where: { id: quizId } }).catch(() => { throw new Error('NOT_FOUND') })

            if (quiz.status !== 'PUBLISHED') throw new Error('VALIDATION_ERROR')

            const attempts = await tx.studentAttempt.findMany({
                where: { quizId, status: 'IN_PROGRESS', expiresAt: { not: null } }
            })
            for (const attempt of attempts) {
                await tx.studentAttempt.update({
                    where: { id: attempt.id },
                    data: { expiresAt: new Date(attempt.expiresAt!.getTime() + addedMinutes * 60_000) }
                })
            }

            const updatedQuiz = await tx.quiz.findUniqueOrThrow({ where: { id: quizId } })
            const extension = await tx.quizTimeExtension.create({
                data: { quizId, extendedBy: actorId, addedMinutes, reason: reason ?? null, appliedAt: new Date() },
            })

            return { quiz: updatedQuiz, extension }
        })
    },

    async addQuestion(quizId: string, actorId: string, data: AddQuizQuestionInput) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER', 'EDITOR'])

        const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } }).catch(() => { throw new Error('NOT_FOUND') })
        if (quiz.status !== 'DRAFT') throw new Error('VALIDATION_ERROR')

        if ((!data.questionBankId && !data.customQuestion) || (data.questionBankId && data.customQuestion)) {
            throw new Error('VALIDATION_ERROR')
        }

        let snapshot: any
        let points: number

        if (data.questionBankId) {
            const bankQ = await prisma.questionBank.findUniqueOrThrow({
                where: { id: data.questionBankId },
            }).catch(() => { throw new Error('NOT_FOUND') })

            if (bankQ.isArchived) throw new Error('VALIDATION_ERROR')

            points = data.points ?? bankQ.points
            snapshot = {
                type: bankQ.type,
                question: bankQ.question,
                options: bankQ.options,
                answerKey: bankQ.answerKey,
                points,
            }
        } else if (data.customQuestion) {
            if (!data.customQuestion.type || !data.customQuestion.question) throw new Error('VALIDATION_ERROR')
            points = data.points ?? data.customQuestion.points ?? 1
            const difficulty = data.customQuestion.difficulty ?? 'MEDIUM'
            snapshot = { ...data.customQuestion, points, difficulty }
        } else {
            throw new Error('VALIDATION_ERROR')
        }

        return prisma.quizQuestion.create({
            data: {
                quizId,
                questionBankId: data.questionBankId ?? null,
                questionSnapshot: snapshot,
                order: data.order ?? 0,
                points,
            },
        })
    },

    async updateQuestion(quizId: string, actorId: string, qId: string, data: UpdateQuizQuestionInput) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER', 'EDITOR'])

        const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } }).catch(() => { throw new Error('NOT_FOUND') })
        if (quiz.status !== 'DRAFT') throw new Error('VALIDATION_ERROR')

        const question = await prisma.quizQuestion.findUniqueOrThrow({ where: { id: qId, quizId } })

        // Merge existing snapshot with updated customQuestion or flat fields
        const currentSnapshot = (question.questionSnapshot as any) || {}

        let newSnapshot = { ...currentSnapshot }

        if (data.customQuestion) {
            newSnapshot = { ...newSnapshot, ...data.customQuestion }
        } else {
            // Pick available flat fields
            if (data.type) newSnapshot.type = data.type
            if (data.difficulty) newSnapshot.difficulty = data.difficulty
            if (data.question) newSnapshot.question = data.question
            if (data.tags) newSnapshot.tags = data.tags
            if (data.options !== undefined) newSnapshot.options = data.options
            if (data.answerKey !== undefined) newSnapshot.answerKey = data.answerKey
        }

        // Finalize points from payload priority (direct points > customQuestion points > current points)
        const finalPoints = data.points ?? data.customQuestion?.points ?? question.points

        if (newSnapshot.points !== undefined) {
            newSnapshot.points = finalPoints
        }

        return prisma.quizQuestion.update({
            where: { id: qId },
            data: {
                questionSnapshot: newSnapshot,
                ...(finalPoints !== undefined && { points: finalPoints }),
                ...(data.order !== undefined && { order: data.order })
            }
        })
    },

    async reorderQuestions(quizId: string, actorId: string, items: { id: string, order: number }[]) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER', 'EDITOR'])
        const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } }).catch(() => { throw new Error('NOT_FOUND') })
        if (quiz.status !== 'DRAFT') throw new Error('VALIDATION_ERROR')

        await prisma.$transaction(
            items.map(item =>
                prisma.quizQuestion.update({
                    where: { id: item.id, quizId },
                    data: { order: item.order }
                })
            )
        )
        return { success: true }
    },

    async removeQuestion(quizId: string, actorId: string, qId: string) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER', 'EDITOR'])
        const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } }).catch(() => { throw new Error('NOT_FOUND') })
        if (quiz.status !== 'DRAFT') throw new Error('VALIDATION_ERROR')

        const inProgressCount = await prisma.studentAttempt.count({
            where: { quizId, status: 'IN_PROGRESS' }
        })
        if (inProgressCount > 0) throw new Error('VALIDATION_ERROR')

        await prisma.quizQuestion.delete({ where: { id: qId, quizId } }).catch(() => { throw new Error('NOT_FOUND') })
        return { success: true }
    },

    async autoSetPoints(quizId: string, actorId: string) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER', 'EDITOR'])

        const quiz = await prisma.quiz.findUniqueOrThrow({
            where: { id: quizId },
            include: { questions: { orderBy: { order: 'asc' } } },
        }).catch(() => { throw new Error('NOT_FOUND') })

        if (quiz.status !== 'DRAFT') throw new Error('VALIDATION_ERROR: Quiz must be in DRAFT status')
        if (quiz.questions.length === 0) throw new Error('VALIDATION_ERROR: No questions to distribute points to')

        const count = quiz.questions.length
        const base = Math.floor(100 / count)
        const remainder = 100 % count

        await prisma.$transaction(
            quiz.questions.map((q, i) => {
                const pts = i < remainder ? base + 1 : base
                const snapshot = { ...(q.questionSnapshot as any), points: pts }
                return prisma.quizQuestion.update({
                    where: { id: q.id },
                    data: { points: pts, questionSnapshot: snapshot },
                })
            })
        )

        const updated = await prisma.quiz.findUniqueOrThrow({
            where: { id: quizId },
            include: { questions: { orderBy: { order: 'asc' } } },
        })

        return { quiz: updated, totalPoints: 100 }
    },

    async applyBlueprint(quizId: string, actorId: string) {
        await assertCollaboratorRole(quizId, actorId, ['OWNER', 'EDITOR'])

        const quiz = await prisma.quiz.findUniqueOrThrow({
            where: { id: quizId },
            include: { blueprints: true, questions: true },
        }).catch(() => { throw new Error('NOT_FOUND') })

        if (quiz.status !== 'DRAFT') throw new Error('VALIDATION_ERROR')

        const existingBankIds = new Set(
            quiz.questions.map((q) => q.questionBankId).filter(Boolean) as string[]
        )

        let currentOrder = quiz.questions.length
        const summary = { added: 0, insufficient: [] as any[] }

        await prisma.$transaction(async (tx) => {
            for (const blueprint of quiz.blueprints) {
                // Use standard Prisma to match tags within the JSON array
                const candidates = await tx.questionBank.findMany({
                    where: {
                        subjectId: quiz.subjectId,
                        isArchived: false,
                        tags: { array_contains: blueprint.tag }
                    },
                    select: { id: true }
                })

                // Randomize in JS to avoid raw SQL differences
                candidates.sort(() => Math.random() - 0.5)

                const eligible = candidates
                    .map((c) => c.id)
                    .filter((id) => !existingBankIds.has(id))
                    .slice(0, blueprint.count)

                if (eligible.length < blueprint.count) {
                    summary.insufficient.push({ tag: blueprint.tag, requested: blueprint.count, got: eligible.length })
                }

                for (const bankId of eligible) {
                    const bankQ = await tx.questionBank.findUniqueOrThrow({ where: { id: bankId } })
                    const points = blueprint.points ?? bankQ.points

                    await tx.quizQuestion.create({
                        data: {
                            quizId,
                            questionBankId: bankQ.id,
                            questionSnapshot: {
                                type: bankQ.type,
                                question: bankQ.question,
                                options: bankQ.options,
                                answerKey: bankQ.answerKey,
                                points,
                            },
                            order: ++currentOrder,
                            points,
                        },
                    })

                    existingBankIds.add(bankQ.id)
                    summary.added++
                }
            }
        })

        return summary
    },
}
