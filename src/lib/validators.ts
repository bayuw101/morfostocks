import { z } from "zod";

// ─── AUTH ─────────────────────────────────────────────────

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

// ─── ONBOARDING ───────────────────────────────────────────

export const onboardingSchema = z.object({
    nis: z.string().min(1, "NIS is required"),
    birthDate: z.string().min(1, "Birth date is required").refine(
        (val) => val === "" || !isNaN(Date.parse(val)),
        "Invalid date format"
    ),
});

// ─── USER MANAGEMENT ──────────────────────────────────────

export const createStudentRecordSchema = z.object({
    nis: z.string().min(1, "NIS is required"),
    fullName: z.string().min(2, "Full name is required"),
    birthDate: z.string().min(1, "Birth date is required").refine((val) => val === "" || !isNaN(Date.parse(val)), "Invalid date"),
    gender: z.enum(["MALE", "FEMALE"]),
    address: z.string().optional(),
    phone: z.string().optional(),
    parentName: z.string().optional(),
    parentPhone: z.string().optional(),
    classId: z.string().min(1, "Invalid class ID"),
    schoolYearId: z.string().uuid("Invalid school year ID"),
});

export const createTeacherSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().optional(), // defaults to birth date if empty
    birthDate: z.string().min(1, "Birth date is required").refine((val) => val === "" || !isNaN(Date.parse(val)), "Invalid date"),
    subjectIds: z.array(z.string()).min(1, "At least one subject required"),
});

export const createAdminSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    birthDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date").optional(),
});

export const changeRoleSchema = z.object({
    userId: z.string().uuid("Invalid user ID"),
    role: z.enum(["STUDENT", "TEACHER", "ADMIN"]),
});
