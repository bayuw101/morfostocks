import { z } from 'zod'
import { QuestionType, Difficulty } from '@prisma/client'

export const updateQuizSettingsSchema = z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().max(1000).optional().nullable(),
    durationMinutes: z.number().int().min(1).max(1440).optional(),
    passingGrade: z.number().min(0).max(100).optional(),
    allowRetake: z.boolean().optional(),
    maxRetake: z.number().int().min(1).optional().nullable(),
    isAccessible: z.boolean().optional(),
    accessMode: z.enum(['ALL_CLASSES', 'SPECIFIC_CLASSES', 'SPECIFIC_STUDENTS']).optional(),
    autoReleaseScore: z.boolean().optional(),
    randomizeQuestions: z.boolean().optional(),
    randomizeOptions: z.boolean().optional(),
    questionsPerAttempt: z.number().int().min(1).optional().nullable(),
    showQuestionNumbers: z.boolean().optional(),
    allowBackNavigation: z.boolean().optional(),
    antiCheatEnabled: z.boolean().optional(),
    maxViolations: z.number().int().min(1).max(10).optional(),
    requireFullscreen: z.boolean().optional(),
    disconnectGraceMinutes: z.number().int().min(0).max(60).optional(),
})

const baseQuestionObjectSchema = z.object({
    type: z.nativeEnum(QuestionType),
    difficulty: z.nativeEnum(Difficulty),
    question: z.string().min(5, "Question text must be at least 5 characters"),
    points: z.number().int().min(1, "Points must be at least 1").max(100).optional().default(1),
    tags: z.array(z.string()).optional().default([]),
    options: z.any().optional().nullable(),
    answerKey: z.any().optional().nullable(),
})

const baseQuestionSchema = baseQuestionObjectSchema.superRefine((data, ctx) => {
    if (data.type === 'MULTIPLE_CHOICE') {
        if (!Array.isArray(data.options) || data.options.length < 2) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Multiple choice requires at least 2 options", path: ['options'] });
        } else {
            data.options.forEach((opt, idx) => {
                if (typeof opt !== 'string' || opt.trim().length === 0) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option cannot be empty", path: ['options', idx] });
                }
            })
        }
        if (
            !data.answerKey ||
            (typeof data.answerKey === 'string' && data.answerKey.trim().length === 0) ||
            (Array.isArray(data.answerKey) && data.answerKey.length === 0)
        ) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A correct answer must be selected", path: ['answerKey'] });
        }
    } else if (data.type === 'SHORT_ANSWER') {
        if (typeof data.answerKey !== 'string' || data.answerKey.trim().length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please provide accepted keywords", path: ['answerKey'] });
        }
    } else if (data.type === 'ESSAY') {
        if (typeof data.answerKey !== 'string' || data.answerKey.trim().length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Grading rubric is required", path: ['answerKey'] });
        }
    }
})

export const createQuestionBankSchema = baseQuestionSchema.extend({
    subjectId: z.string().uuid("Invalid subject ID"),
})

export const updateQuestionBankSchema = baseQuestionObjectSchema.partial().extend({
    subjectId: z.string().uuid("Invalid subject ID").optional(),
})

export const createQuizQuestionSchema = z.union([
    z.object({
        questionBankId: z.string().uuid("Invalid question bank ID"),
        order: z.number().int().min(0).optional(),
        points: z.number().int().min(1).max(100).optional(),
    }),
    z.object({
        customQuestion: baseQuestionSchema,
        order: z.number().int().min(0).optional(),
        points: z.number().int().min(1, "Points must be at least 1").max(100).optional(),
    }),
    baseQuestionSchema.extend({
        order: z.number().int().min(0).optional(),
    })
])

export const updateQuizQuestionSchema = z.union([
    z.object({
        customQuestion: baseQuestionObjectSchema.partial(),
        order: z.number().int().min(0).optional(),
        points: z.number().int().min(1).max(100).optional(),
    }),
    baseQuestionObjectSchema.partial().extend({
        order: z.number().int().min(0).optional(),
    })
])

// Blueprints
export const createBlueprintSchema = z.object({
    tag: z.string().min(1, "Tag is required"),
    count: z.number().int().min(1).max(100),
    points: z.number().int().min(1).optional().nullable(),
})

export const updateBlueprintSchema = createBlueprintSchema.partial()

// Collaborators
export const addCollaboratorSchema = z.object({
    userId: z.string().uuid("Invalid user ID"),
    role: z.enum(['EDITOR', 'VIEWER']), // OWNER usually set implicitly
})

// Class Access
export const updateClassAccessSchema = z.object({
    classIds: z.array(z.string().uuid("Invalid class ID")),
})

// Prerequisites
export const updatePrerequisitesSchema = z.object({
    prerequisiteIds: z.array(z.string().uuid("Invalid prerequisite ID")),
})
