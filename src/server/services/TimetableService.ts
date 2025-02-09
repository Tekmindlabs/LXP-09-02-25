import { PrismaClient } from "@prisma/client";
import { AvailabilityCheck, PeriodInput, ScheduleConflict, TimetableInput } from "@/types/timetable";

export class TimetableService {

	constructor(private prisma: PrismaClient) {}

	private isTimeOverlapping(
		start1: string,
		end1: string,
		start2: string,
		end2: string
	): boolean {
		return start1 < end2 && end1 > start2;
	}

	async checkAvailability(period: PeriodInput, breakTimes: { startTime: string; endTime: string; dayOfWeek: number }[]): Promise<AvailabilityCheck> {
		const conflicts: ScheduleConflict[] = [];

		// Check teacher availability
		const teacherConflict = await this.prisma.period.findFirst({
			where: {
				teacherId: period.teacherId,
				dayOfWeek: period.dayOfWeek,
				OR: [
					{
						startTime: { lte: period.endTime },
						endTime: { gte: period.startTime }
					}
				]
			}
		});

		if (teacherConflict) {
			conflicts.push({
				type: 'TEACHER',
				details: {
					startTime: teacherConflict.startTime.toISOString(),
					endTime: teacherConflict.endTime.toISOString(),
					dayOfWeek: teacherConflict.dayOfWeek,
					entityId: period.teacherId
				}
			});
		}

		// Check classroom availability
		const classroomConflict = await this.prisma.period.findFirst({
			where: {
				classroomId: period.classroomId,
				dayOfWeek: period.dayOfWeek,
				OR: [
					{
						startTime: { lte: period.endTime },
						endTime: { gte: period.startTime }
					}
				]
			}
		});

		if (classroomConflict) {
			conflicts.push({
				type: 'CLASSROOM',
				details: {
					startTime: classroomConflict.startTime.toISOString(),
					endTime: classroomConflict.endTime.toISOString(),
					dayOfWeek: classroomConflict.dayOfWeek,
					entityId: period.classroomId
				}
			});
		}

		// Check break time conflicts
		const breakTimeConflict = breakTimes.find(
			breakTime =>
				breakTime.dayOfWeek === period.dayOfWeek &&
				this.isTimeOverlapping(
					period.startTime,
					period.endTime,
					breakTime.startTime,
					breakTime.endTime
				)
		);

		if (breakTimeConflict) {
			conflicts.push({
				type: 'BREAK_TIME',
				details: {
					startTime: breakTimeConflict.startTime,
					endTime: breakTimeConflict.endTime,
					dayOfWeek: breakTimeConflict.dayOfWeek,
					entityId: 'break'
				}
			});
		}

		return {
			isAvailable: conflicts.length === 0,
			conflicts
		};
	}

	async createTimetable(input: TimetableInput) {
        const timetable = await this.prisma.timetable.create({
            data: {
                term: { connect: { id: input.termId } },
                classGroup: { connect: { id: input.classGroupId } },
                class: { connect: { id: input.classId } }
            }
        });

        // Create periods
        await this.prisma.period.createMany({
            data: input.periods.map(period => ({
                timetableId: timetable.id,
                startTime: new Date(`1970-01-01T${period.startTime}:00`),
                endTime: new Date(`1970-01-01T${period.endTime}:00`),
                dayOfWeek: period.dayOfWeek,
                durationInMinutes: period.durationInMinutes,
                subjectId: period.subjectId,
                teacherId: period.teacherId,
                classroomId: period.classroomId
            }))
        });

        // Create break times using raw SQL
        if (input.breakTimes.length > 0) {
            await this.prisma.$executeRaw`
                INSERT INTO "break_times" ("id", "startTime", "endTime", "type", "dayOfWeek", "timetableId", "createdAt", "updatedAt")
                VALUES ${input.breakTimes.map(bt => `(
                    gen_random_uuid(),
                    ${bt.startTime},
                    ${bt.endTime},
                    ${bt.type},
                    ${bt.dayOfWeek},
                    ${timetable.id},
                    NOW(),
                    NOW()
                )`).join(', ')}
            `;
        }

        return this.prisma.timetable.findUnique({
            where: { id: timetable.id },
            include: {
                periods: {
                    include: {
                        subject: true,
                        teacher: true,
                        classroom: true
                    }
                }
            }
        });

	}
}