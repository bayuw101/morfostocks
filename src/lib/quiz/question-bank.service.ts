import { prisma } from '@/lib/prisma'
import { CreateQuestionBankInput } from './quiz.types'

export const QuestionBankService = {
    async list(filters: {
        subjectId?: string
        type?: string
        difficulty?: string
        tags?: string[]
        isArchived?: boolean
        createdBy?: string
    }) {
        return prisma.questionBank.findMany({
            where: {
                ...(filters.subjectId && { subjectId: filters.subjectId }),
                isArchived: filters.isArchived ?? false,
                ...(filters.type && { type: filters.type as any }),
                ...(filters.difficulty && { difficulty: filters.difficulty as any }),
                ...(filters.createdBy && { createdBy: filters.createdBy }),
                ...(filters.tags && filters.tags.length > 0 && {
                    tags: { array_contains: filters.tags }
                })
            },
            include: {
                subject: true,
                _count: { select: { quizItems: true } },
            },
            orderBy: { createdAt: 'desc' },
        })
    },

    async create(userId: string, data: CreateQuestionBankInput) {
        // Validation is handled by Zod schema at the route level

        return prisma.questionBank.create({
            data: {
                subjectId: data.subjectId,
                createdBy: userId,
                type: data.type,
                question: data.question,
                options: data.options ?? null,
                answerKey: data.answerKey ?? null,
                points: data.points ?? 1,
                difficulty: data.difficulty,
                tags: data.tags ?? [],
                isArchived: false,
            },
        })
    },

    async update(id: string, userId: string, data: Partial<CreateQuestionBankInput>) {
        const q = await prisma.questionBank.findUniqueOrThrow({ where: { id } }).catch(() => { throw new Error('NOT_FOUND') })
        if (q.createdBy !== userId && !['ADMIN', 'TEACHER'].includes(userId)) {
            // we will just assume role check happens in the caller, here we just do a basic check
            // if (q.createdBy !== userId) throw new Error('FORBIDDEN') is too strict if another teacher modifies it? 
            // the question bank might be global. Let's restrict to createdBy for now
            if (q.createdBy !== userId) throw new Error('FORBIDDEN')
        }

        // Validation is handled by Zod schema at the route level

        return prisma.questionBank.update({
            where: { id },
            data: {
                ...(data.subjectId && { subjectId: data.subjectId }),
                ...(data.type && { type: data.type }),
                ...(data.question && { question: data.question }),
                ...(data.options !== undefined && { options: data.options ?? null }),
                ...(data.answerKey !== undefined && { answerKey: data.answerKey ?? null }),
                ...(data.points !== undefined && { points: data.points }),
                ...(data.difficulty && { difficulty: data.difficulty }),
                ...(data.tags && { tags: data.tags }),
            },
        })
    },

    async delete(id: string, userId: string) {
        const q = await prisma.questionBank.findUniqueOrThrow({ where: { id } }).catch(() => { throw new Error('NOT_FOUND') })
        if (q.createdBy !== userId) throw new Error('FORBIDDEN')
        return prisma.questionBank.delete({ where: { id } })
    },

    async archive(id: string, userId: string) {
        const q = await prisma.questionBank.findUniqueOrThrow({ where: { id } }).catch(() => { throw new Error('NOT_FOUND') })
        if (q.createdBy !== userId) throw new Error('FORBIDDEN')
        return prisma.questionBank.update({ where: { id }, data: { isArchived: true } })
    },

    async restore(id: string, userId: string) {
        const q = await prisma.questionBank.findUniqueOrThrow({ where: { id } }).catch(() => { throw new Error('NOT_FOUND') })
        if (q.createdBy !== userId) throw new Error('FORBIDDEN')
        return prisma.questionBank.update({ where: { id }, data: { isArchived: false } })
    },

    async getDistinctTags(subjectId: string): Promise<string[]> {
        const rows = await prisma.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT jsonb_array_elements_text(tags) AS tag
      FROM question_bank
      WHERE subject_id  = ${subjectId}
        AND is_archived = false
      ORDER BY tag
    `
        return rows.map((r) => r.tag)
    },
}
