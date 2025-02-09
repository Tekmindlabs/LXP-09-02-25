import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { 
	ActivityType, 
	ActivityMode, 
	ActivityStatus, 
	ActivityGradingType, 
	ActivityViewType,
	ActivityResourceType,
	ActivitySubmissionStatus 
} from "../../types/class-activity";


export const classActivityRouter = createTRPCRouter({
	create: protectedProcedure
		.input(z.object({
			title: z.string(),
			description: z.string().optional(),
			type: z.nativeEnum(ActivityType),
			classId: z.string().optional(),
			subjectId: z.string(),
			classGroupId: z.string().optional(),
			configuration: z.object({
				activityMode: z.nativeEnum(ActivityMode),
				isGraded: z.boolean().default(true),
				totalMarks: z.number().min(1),
				passingMarks: z.number().min(1),
				gradingType: z.nativeEnum(ActivityGradingType),
				availabilityDate: z.date(),
				deadline: z.date(),
				instructions: z.string().optional(),
				timeLimit: z.number().optional(),
				attempts: z.number().optional(),
				viewType: z.nativeEnum(ActivityViewType),
				autoGradingConfig: z.object({
					scorePerQuestion: z.number(),
					penaltyPerWrongAnswer: z.number(),
					allowPartialCredit: z.boolean()
				}).optional()
			}),
			resources: z.array(z.object({
				title: z.string(),
				type: z.nativeEnum(ActivityResourceType),
				url: z.string()
			})).optional()
		}))
		.mutation(async ({ ctx, input }) => {
			const { resources, configuration, ...activityData } = input;
			
			return ctx.prisma.classActivity.create({
				data: {
					...activityData,
					status: ActivityStatus.PUBLISHED,
					configuration: {
						create: configuration
					},
					...(resources && {
						resources: {
							create: resources
						}
					})
				},
				include: {
					configuration: true,
					resources: true,
					class: {
						select: { name: true }
					},
					classGroup: {
						select: { name: true }
					}
				}
			});
		}),

	getAll: protectedProcedure
		.input(z.object({
			classId: z.string().optional(),
			search: z.string().optional(),
			type: z.nativeEnum(ActivityType).optional(),
			classGroupId: z.string().optional()
		}))
		.query(async ({ ctx, input }) => {
			const { search, type, classId, classGroupId } = input;
			
			return ctx.prisma.classActivity.findMany({
				where: {
					...(classId && { classId }),
					...(type && { type }),
					...(classGroupId && { classGroupId }),
					...(search && {
						OR: [
							{ title: { contains: search, mode: 'insensitive' } },
							{ description: { contains: search, mode: 'insensitive' } },
						],
					}),
				},
				include: {
					configuration: true,
					resources: true,
					class: {
						select: { name: true }
					},
					classGroup: {
						select: { name: true }
					},
					submissions: {
						select: {
							id: true,
							status: true,
							submittedAt: true,
							studentId: true,
							obtainedMarks: true,
							totalMarks: true,
							feedback: true,
							student: {
								select: {
									id: true,
									name: true
								}
							}
						}
					}
				},
				orderBy: { createdAt: 'desc' }
			});
		}),



	getById: protectedProcedure
		.input(z.string())
		.query(async ({ ctx, input }) => {
			try {
				const activity = await ctx.prisma.classActivity.findUnique({
					where: { id: input },
					include: {
						resources: true,
						class: {
							select: {
								name: true
							}
						},
						classGroup: {
							select: {
								name: true
							}
						},
						submissions: {
							select: {
								id: true,
								status: true,
								submittedAt: true,
								studentId: true,
								obtainedMarks: true,
								totalMarks: true,
								feedback: true,
								student: {
									select: {
										id: true,
										name: true
									}
								}
							}
						}
					}
				});

				if (!activity) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'Activity not found',
					});
				}

				return activity;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error('Error in getById query:', error);
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to fetch activity details. Please try again.',
					cause: error
				});
			}
		}),


	update: protectedProcedure
		.input(z.object({
			id: z.string(),
			title: z.string(),
			description: z.string().optional(),
			type: z.enum(Object.values(ActivityTypes) as [ActivityType, ...ActivityType[]]),
			classId: z.string(),
			subjectId: z.string(),
			deadline: z.date().optional(),
			gradingCriteria: z.string().optional(),
			configuration: z.object({
				totalMarks: z.number().min(1),
				passingMarks: z.number().min(1),
				activityMode: z.enum(['ONLINE', 'IN_CLASS']),
				gradingType: z.enum(['AUTOMATIC', 'MANUAL']),
				isGraded: z.boolean(),
				timeLimit: z.number().optional(),
				attempts: z.number().optional(),
			})
		}))
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			return ctx.prisma.classActivity.update({
				where: { id },
				data,
				include: {
					resources: true
				}
			});
		}),

	delete: protectedProcedure
		.input(z.string())
		.mutation(async ({ ctx, input }) => {
			return ctx.prisma.classActivity.delete({
				where: { id: input }
			});
		}),

	submitActivity: protectedProcedure
		.input(z.object({
			activityId: z.string(),
			studentId: z.string(),
			content: z.any(),
			status: z.nativeEnum(ActivitySubmissionStatus)
		}))
		.mutation(async ({ ctx, input }) => {
			const activity = await ctx.prisma.classActivity.findUnique({
				where: { id: input.activityId },
				include: { configuration: true }
			});

			if (!activity?.configuration) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Activity or configuration not found',
				});
			}

			return ctx.prisma.activitySubmission.create({
				data: {
					activity: { connect: { id: input.activityId } },
					student: { connect: { id: input.studentId } },
					status: input.status,
					content: input.content,
					submittedAt: new Date(),
					totalMarks: activity.configuration.totalMarks,
					gradingType: activity.configuration.gradingType
				}
			});
		}),

	gradeSubmission: protectedProcedure
		.input(z.object({
			submissionId: z.string(),
			obtainedMarks: z.number(),
			feedback: z.string().optional()
		}))
		.mutation(async ({ ctx, input }) => {
			const submission = await ctx.prisma.activitySubmission.findUnique({
				where: { id: input.submissionId },
				include: {
					activity: {
						include: { configuration: true }
					}
				}
			});

			if (!submission?.activity.configuration) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Submission or activity configuration not found',
				});
			}

			const isPassing = input.obtainedMarks >= submission.activity.configuration.passingMarks;

			return ctx.prisma.activitySubmission.update({
				where: { id: input.submissionId },
				data: {
					obtainedMarks: input.obtainedMarks,
					feedback: input.feedback,
					isPassing,
					status: ActivitySubmissionStatus.GRADED,
					gradedAt: new Date(),
					gradedBy: ctx.session.user.id
				}
			});
		})
});