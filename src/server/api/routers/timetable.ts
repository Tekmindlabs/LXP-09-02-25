import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TimetableService } from "@/server/services/TimetableService";
import { periodInputSchema, timetableInputSchema, isTimeOverlapping, ScheduleConflict } from "@/types/timetable";
import { Prisma } from "@prisma/client";

// Define the period include type
const periodWithRelations = Prisma.validator<Prisma.PeriodInclude>()({
	subject: true,
	teacher: {
		include: {
			user: true
		}
	},
	classroom: true,
	timetable: {
		include: {
			class: true
		}
	}
});

type PeriodWithRelations = Prisma.PeriodGetPayload<{
	include: typeof periodWithRelations
}>;

type ScheduleResponse = {
	periods: PeriodWithRelations[];
	breakTimes: {
		id: string;
		startTime: string;
		endTime: string;
		type: string;
		dayOfWeek: number;
		timetableId: string;
		createdAt: Date;
		updatedAt: Date;
	}[];
};

export const timetableRouter = createTRPCRouter({
	checkAvailability: protectedProcedure
		.input(z.object({
			period: periodInputSchema,
			breakTimes: z.array(z.object({
				startTime: z.string(),
				endTime: z.string(),
				dayOfWeek: z.number()
			}))
		}))
		.mutation(async ({ ctx, input }) => {
			const conflicts: ScheduleConflict[] = [];

			// Check conflicts for each selected day
			for (const dayOfWeek of input.period.daysOfWeek) {
				// Check break time conflicts
				const breakTimeConflict = input.breakTimes.find(breakTime =>
					breakTime.dayOfWeek === dayOfWeek &&
					isTimeOverlapping(
						input.period.startTime,
						input.period.endTime,
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

				// Check teacher availability
				const teacherConflict = await ctx.prisma.period.findFirst({
					where: {
						teacherId: input.period.teacherId,
						dayOfWeek: dayOfWeek,
						OR: [
							{
								startTime: { lte: new Date(`1970-01-01T${input.period.endTime}`) },
								endTime: { gte: new Date(`1970-01-01T${input.period.startTime}`) }
							}
						]
					},
					include: {
						timetable: {
							include: {
								class: true
							}
						}
					}
				});

				if (teacherConflict) {
					conflicts.push({
						type: 'TEACHER',
						details: {
							startTime: teacherConflict.startTime.toTimeString().slice(0, 5),
							endTime: teacherConflict.endTime.toTimeString().slice(0, 5),
							dayOfWeek: teacherConflict.dayOfWeek,
							entityId: teacherConflict.teacherId,
							additionalInfo: `Class: ${teacherConflict.timetable.class.name}`
						}
					});
				}

				// Check classroom availability
				const classroomConflict = await ctx.prisma.period.findFirst({
					where: {
						classroomId: input.period.classroomId,
						dayOfWeek: dayOfWeek,
						OR: [
							{
								startTime: { lte: new Date(`1970-01-01T${input.period.endTime}`) },
								endTime: { gte: new Date(`1970-01-01T${input.period.startTime}`) }
							}
						]
					},
					include: {
						timetable: {
							include: {
								class: true
							}
						}
					}
				});

				if (classroomConflict) {
					conflicts.push({
						type: 'CLASSROOM',
						details: {
							startTime: classroomConflict.startTime.toTimeString().slice(0, 5),
							endTime: classroomConflict.endTime.toTimeString().slice(0, 5),
							dayOfWeek: classroomConflict.dayOfWeek,
							entityId: classroomConflict.classroomId,
							additionalInfo: `Class: ${classroomConflict.timetable.class.name}`
						}
					});
				}
			}

			return {
				isAvailable: conflicts.length === 0,
				conflicts
			};
		}),

	create: protectedProcedure
		.input(timetableInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				// Check if timetable already exists for the class/classGroup in this term
				const existingTimetable = await ctx.prisma.timetable.findFirst({
					where: {
						AND: [
							{
								OR: [
									{ classId: input.classId },
									{ classGroupId: input.classGroupId }
								]
							},
							{ termId: input.termId }
						]
					}
				});

				if (existingTimetable) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'A timetable already exists for this class in the selected term'
					});
				}

				const timetableService = new TimetableService(ctx.prisma);
				return timetableService.createTimetable(input);
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to create timetable',
					cause: error
				});
			}
		}),

	getTeacherSchedule: protectedProcedure
		.input(z.object({
			teacherId: z.string(),
			termId: z.string()
		}))
		.query(async ({ ctx, input }): Promise<ScheduleResponse> => {
			try {
				const timetables = await ctx.prisma.$queryRaw<Array<{ breakTimes: ScheduleResponse['breakTimes'] }>>`
					SELECT bt.*
					FROM "break_times" bt
					JOIN "timetables" t ON t."id" = bt."timetableId"
					JOIN "periods" p ON p."timetableId" = t."id"
					WHERE t."termId" = ${input.termId}
					AND p."teacherId" = ${input.teacherId}
				`;

				const periods = await ctx.prisma.period.findMany({
					where: {
						teacherId: input.teacherId,
						timetable: {
							termId: input.termId
						}
					},
					include: periodWithRelations,
					orderBy: [
						{ dayOfWeek: 'asc' },
						{ startTime: 'asc' }
					]
				});

				return {
					periods,
					breakTimes: timetables[0]?.breakTimes ?? []
				};
			} catch (error) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to fetch teacher schedule',
					cause: error
				});
			}
		}),


	getClassroomSchedule: protectedProcedure
		.input(z.object({
			classroomId: z.string(),
			termId: z.string()
		}))
		.query(async ({ ctx, input }): Promise<ScheduleResponse> => {
			try {
				const timetables = await ctx.prisma.$queryRaw<Array<{ breakTimes: ScheduleResponse['breakTimes'] }>>`
					SELECT bt.*
					FROM "break_times" bt
					JOIN "timetables" t ON t."id" = bt."timetableId"
					JOIN "periods" p ON p."timetableId" = t."id"
					WHERE t."termId" = ${input.termId}
					AND p."classroomId" = ${input.classroomId}
				`;

				const periods = await ctx.prisma.period.findMany({
					where: {
						classroomId: input.classroomId,
						timetable: {
							termId: input.termId
						}
					},
					include: periodWithRelations,
					orderBy: [
						{ dayOfWeek: 'asc' },
						{ startTime: 'asc' }
					]
				});

				return {
					periods,
					breakTimes: timetables[0]?.breakTimes ?? []
				};
			} catch (error) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to fetch classroom schedule',
					cause: error
				});
			}
		}),




	getAll: protectedProcedure.query(({ ctx }) => {
		return ctx.prisma.timetable.findMany({
			include: {
				periods: {
					include: {
						subject: true,
						classroom: true,
						teacher: {
							include: {
								user: true
							}
						}
					},
				},
				classGroup: true,
				class: true,
				breakTimes: true
			},
		});
	}),

	getById: protectedProcedure
		.input(z.string())
		.query(({ ctx, input }) => {
			return ctx.prisma.timetable.findUnique({
				where: { id: input },
				include: {
					periods: {
						include: {
							subject: true,
							classroom: true,
							teacher: {
								include: {
									user: true
								}
							}
						},
					},
					classGroup: true,
					class: true,
					breakTimes: true
				},
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				periods: z.array(
					z.object({
						id: z.string().optional(),
						startTime: z.date(),
						endTime: z.date(),
						durationInMinutes: z.number().int().min(1).max(240).optional().default(45),
						dayOfWeek: z.number().min(1).max(7),
						subjectId: z.string(),
						classroomId: z.string(),
						teacherId: z.string(),
					})
				),
			})
		)
		.mutation(async ({ ctx, input }) => {
			// Delete existing periods
			await ctx.prisma.period.deleteMany({
				where: { timetableId: input.id },
			});

			// Process each period and get teacher profiles
			const periodsWithTeachers = await Promise.all(
				input.periods.map(async (period) => {
					const teacherProfile = await ctx.prisma.teacherProfile.findFirst({
						where: { userId: period.teacherId },
					});

					if (!teacherProfile) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Teacher profile not found for teacher ID ${period.teacherId}`,
						});
					}

					return {
						...period,
						teacherProfileId: teacherProfile.id,
					};
				})
			);

			// Create new periods
			return ctx.prisma.timetable.update({
				where: { id: input.id },
				data: {
					periods: {
						create: periodsWithTeachers.map(period => ({
							startTime: period.startTime,
							endTime: period.endTime,
							dayOfWeek: period.dayOfWeek,
							durationInMinutes: period.durationInMinutes ?? 45,
							subject: { connect: { id: period.subjectId } },
							classroom: { connect: { id: period.classroomId } },
							teacher: { connect: { id: period.teacherProfileId } },
						})),
					},
				},
				include: {
					periods: {
						include: {
							subject: true,
							classroom: true,
							teacher: true,
						},
					},
				},
			});
		}),

	delete: protectedProcedure
		.input(z.string())
		.mutation(({ ctx, input }) => {
			return ctx.prisma.timetable.delete({
				where: { id: input },
			});
		}),

	createPeriod: protectedProcedure
		.input(z.object({
			startTime: z.date(),
			endTime: z.date(),
			daysOfWeek: z.array(z.number().min(1).max(7)),
			durationInMinutes: z.number().int().min(1).max(240),
			subjectId: z.string(),
			classroomId: z.string(),
			teacherId: z.string(),
			timetableId: z.string(),
		}))
		.mutation(async ({ ctx, input }) => {
			const teacherProfile = await ctx.prisma.teacherProfile.findFirst({
				where: { userId: input.teacherId },
			});

			if (!teacherProfile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Teacher profile not found",
				});
			}

			// Create periods for each selected day
			const periods = await Promise.all(
				input.daysOfWeek.map(async (dayOfWeek) => {
					return ctx.prisma.period.create({
						data: {
							startTime: input.startTime,
							endTime: input.endTime,
							dayOfWeek,
							durationInMinutes: input.durationInMinutes,
							subject: { connect: { id: input.subjectId } },
							classroom: { connect: { id: input.classroomId } },
							timetable: { connect: { id: input.timetableId } },
							teacher: { connect: { id: teacherProfile.id } },
						},
						include: {
							subject: true,
							classroom: true,
							teacher: {
								include: {
									user: true,
								},
							},
						},
					});
				})
			);

			return periods;
		}),


	updatePeriod: protectedProcedure
		.input(z.object({
			id: z.string(),
			startTime: z.date(),
			endTime: z.date(),
			daysOfWeek: z.array(z.number().min(1).max(7)),
			durationInMinutes: z.number().int().min(1).max(240),
			subjectId: z.string(),
			classroomId: z.string(),
			teacherId: z.string(),
		}))
		.mutation(async ({ ctx, input }) => {
			const teacherProfile = await ctx.prisma.teacherProfile.findFirst({
				where: { userId: input.teacherId },
			});

			if (!teacherProfile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Teacher profile not found",
				});
			}

			// Delete the existing period
			await ctx.prisma.period.delete({
				where: { id: input.id }
			});

			// Create new periods for each selected day
			const periods = await Promise.all(
				input.daysOfWeek.map(async (dayOfWeek) => {
					return ctx.prisma.period.create({
						data: {
							startTime: input.startTime,
							endTime: input.endTime,
							dayOfWeek,
							durationInMinutes: input.durationInMinutes,
							subject: { connect: { id: input.subjectId } },
							classroom: { connect: { id: input.classroomId } },
							teacher: { connect: { id: teacherProfile.id } },
							timetable: { connect: { id: (await ctx.prisma.period.findUnique({ where: { id: input.id } }))?.timetableId! } }
						},
						include: {
							subject: true,
							classroom: true,
							teacher: {
								include: {
									user: true,
								},
							},
						},
					});
				})
			);

			return periods;
		}),

});