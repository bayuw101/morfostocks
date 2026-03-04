import { QuestionType, Difficulty } from '@prisma/client'

export interface AnswerEntry {
    selectedOptionId?: string | null;
    essayAnswer?: string | null;
    isCorrect?: boolean | null;
    score?: number | null;
}

export interface AnswersMeta {
    totalQuestions: number;
    autoGraded: boolean;
}

export interface AnswersJson {
    meta: AnswersMeta;
    answers: Record<string, AnswerEntry>;
}

export interface CreateQuizInput {
    title: string;
    description?: string | null;
    subjectId: string;
    durationMinutes: number;
    passingGrade?: number | null;
    autoReleaseScore?: boolean;
    allowRetake?: boolean;
    maxRetake?: number;
    pinCode?: string;
    accessMode?: 'ALL_CLASSES' | 'SPECIFIC_CLASSES' | 'SPECIFIC_STUDENTS';
    randomizeQuestions?: boolean;
    randomizeOptions?: boolean;
    questionsPerAttempt?: number;
    showQuestionNumbers?: boolean;
    allowBackNavigation?: boolean;
    antiCheatEnabled?: boolean;
    maxViolations?: number;
    requireFullscreen?: boolean;
    disconnectGraceMinutes?: number;
}

export type UpdateQuizInput = Partial<CreateQuizInput> & {
    maxAttempts?: number | null;
    maxRetake?: number | null;
    isAccessible?: boolean;
    status?: string;
};

export interface AddQuizQuestionInput {
    type?: QuestionType;
    difficulty?: Difficulty;
    question?: string;
    points?: number;
    tags?: string[];
    options?: any;
    answerKey?: any;
    order?: number;
    questionBankId?: string; // For adding from bank
    customQuestion?: any; // For legacy structure compatibility
}

export type UpdateQuizQuestionInput = Partial<AddQuizQuestionInput>;

export interface CreateQuestionBankInput {
    subjectId: string;
    type: QuestionType;
    question: string;
    options?: any;
    answerKey?: any;
    points?: number;
    difficulty?: Difficulty;
    tags?: string[];
}
