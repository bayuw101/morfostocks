import { prisma } from '@/lib/prisma'

export interface CreateCourseInput {
    title: string;
    description?: string;
    subjectId: string;
    order?: number;
    content?: any;
}

export const CourseService = {
    async list(subjectId?: string) {
        return prisma.course.findMany({
            where: subjectId ? { subjectId } : undefined,
            orderBy: { order: 'asc' },
        })
    },

    async create(userId: string, data: CreateCourseInput) {
        if (!data.title || data.title.trim() === '') throw new Error('VALIDATION_ERROR')

        return prisma.course.create({
            data: {
                title: data.title,
                description: data.description,
                subjectId: data.subjectId,
                createdBy: userId,
                order: data.order ?? 0,
                content: data.content ?? null,
                isPublished: false,
            },
        })
    },

    async update(id: string, userId: string, data: Partial<CreateCourseInput>) {
        const course = await prisma.course.findUniqueOrThrow({ where: { id } }).catch(() => { throw new Error('NOT_FOUND') })
        if (course.createdBy !== userId) throw new Error('FORBIDDEN')
        return prisma.course.update({ where: { id }, data })
    },

    async delete(id: string, userId: string) {
        const course = await prisma.course.findUniqueOrThrow({ where: { id } }).catch(() => { throw new Error('NOT_FOUND') })
        if (course.createdBy !== userId) throw new Error('FORBIDDEN')
        return prisma.course.delete({ where: { id } })
    },

    async publish(id: string, userId: string) {
        const course = await prisma.course.findUniqueOrThrow({ where: { id } }).catch(() => { throw new Error('NOT_FOUND') })
        if (course.createdBy !== userId) throw new Error('FORBIDDEN')
        return prisma.course.update({ where: { id }, data: { isPublished: true } })
    },

    async reorder(items: { id: string, order: number }[]) {
        await prisma.$transaction(
            items.map(item =>
                prisma.course.update({
                    where: { id: item.id },
                    data: { order: item.order }
                })
            )
        )
        return { success: true }
    },
}
