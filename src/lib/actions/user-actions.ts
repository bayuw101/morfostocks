"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function deleteUserAction(id: string) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;
        if (token) {
            const payload = await verifyToken(token);
            if (payload && payload.userId === id) {
                return { success: false, error: "Cannot delete your own account" };
            }
        }

        // Find if user is a student with a record
        const user = await prisma.user.findUnique({
            where: { id },
            include: { studentRecord: true },
        });

        if (user?.studentRecord) {
            // Delete student record first or let cascade handle it?
            // In schema, studentRecord has userId String? @unique. 
            // Better to delete both.
            await prisma.studentRecord.delete({
                where: { id: user.studentRecord.id },
            });
        }

        await prisma.user.delete({
            where: { id },
        });

        revalidatePath("/admin/accounts");
        return { success: true };
    } catch (error) {
        console.error("Delete user error:", error);
        return { success: false, error: "Failed to delete user" };
    }
}

export async function deleteStudentRecordAction(recordId: string) {
    try {
        const record = await prisma.studentRecord.findUnique({
            where: { id: recordId },
        });

        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;
        if (token && record?.userId) {
            const payload = await verifyToken(token);
            if (payload && payload.userId === record.userId) {
                return { success: false, error: "Cannot delete your own account" };
            }
        }

        if (record?.userId) {
            await prisma.user.delete({
                where: { id: record.userId },
            });
        }

        await prisma.studentRecord.delete({
            where: { id: recordId },
        });

        revalidatePath("/admin/accounts");
        return { success: true };
    } catch (error) {
        console.error("Delete student record error:", error);
        return { success: false, error: "Failed to delete student record" };
    }
}

export async function toggleUserStatusAction(id: string, isActive: boolean) {
    try {
        await prisma.user.update({
            where: { id },
            data: { isActive },
        });
        revalidatePath("/admin/accounts");
        return { success: true };
    } catch (error) {
        console.error("Toggle user status error:", error);
        return { success: false, error: "Failed to update user status" };
    }
}

export async function updateTeacherSubjectsAction(userId: string, subjectIds: string[]) {
    try {
        // Delete existing relations
        await prisma.teacherSubject.deleteMany({
            where: { userId },
        });

        // Create new ones
        await Promise.all(
            subjectIds.map((subjectId) =>
                prisma.teacherSubject.create({
                    data: { userId, subjectId },
                })
            )
        );

        revalidatePath("/admin/accounts");
        return { success: true };
    } catch (error) {
        console.error("Update teacher subjects error:", error);
        return { success: false, error: "Failed to update subjects" };
    }
}
