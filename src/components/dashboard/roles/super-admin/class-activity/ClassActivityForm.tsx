'use client';

import { useForm, UseFormReturn } from "react-hook-form";
import { useState } from "react";

type Resource = {
	title: string;
	type: ActivityResourceType;
	url: string;
	fileInfo?: {
		size: number;
		createdAt: Date;
		updatedAt: Date;
		mimeType: string;
		publicUrl: string;
	};
};

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResourcesSection } from "./ResourcesSection";
import { api } from "@/utils/api";
import { 
	ActivityType, 
	ActivityMode, 
	ActivityGradingType,
	ActivityViewType,
	ActivityResourceType,
	ActivityConfiguration
} from "@/types/class-activity";

import { useEffect } from "react";

type FormData = z.infer<typeof formSchema>;






const formSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	type: z.nativeEnum(ActivityType),
	classId: z.string().optional(),
	subjectId: z.string(),
	classGroupId: z.string().optional(),
	configuration: z.object({
		activityMode: z.nativeEnum(ActivityMode),
		isGraded: z.boolean(),
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
		url: z.string(),
		fileInfo: z.object({
			size: z.number(),
			createdAt: z.date(),
			updatedAt: z.date(),
			mimeType: z.string(),
			publicUrl: z.string()
		}).optional()
	})).optional()
});

interface Props {

	activityId?: string;
	onClose: () => void;
}

export default function ClassActivityForm({ activityId, onClose }: Props) {

	const { toast } = useToast();
	const utils = api.useContext();
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<FormData>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: "",
			description: "",
			type: ActivityType.CLASS_ASSIGNMENT,
			classId: undefined,
			subjectId: "",
			classGroupId: undefined,
			configuration: {
				activityMode: ActivityMode.IN_CLASS,
				isGraded: true,
				totalMarks: 100,
				passingMarks: 40,
				gradingType: ActivityGradingType.MANUAL,
				availabilityDate: new Date(),
				deadline: new Date(),
				instructions: "",
				timeLimit: undefined,
				attempts: undefined,
				viewType: ActivityViewType.STUDENT,
				autoGradingConfig: undefined
			},
			resources: [],
		},
	});

	const { data: classes = [], isLoading: classesLoading } = api.class.list.useQuery();
	const { data: subjects = [], isLoading: subjectsLoading } = api.subject.list.useQuery(
		undefined,
		{ enabled: !!form.watch('classId') }
	);
	const { isLoading: classGroupsLoading } = api.classGroup.list.useQuery();



	const createMutation = api.classActivity.create.useMutation({
		onMutate: () => {
			setIsLoading(true);
		},
		onSuccess: () => {
			toast({
				title: "Success",
				description: "Activity created successfully",
			});
			utils.classActivity.getAll.invalidate();
			onClose();
		},
		onError: (error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
		onSettled: () => {
			setIsLoading(false);
		}
	});

	const updateMutation = api.classActivity.update.useMutation({
		onMutate: () => {
			setIsLoading(true);
		},
		onSuccess: () => {
			toast({
				title: "Success",
				description: "Activity updated successfully",
			});
			utils.classActivity.getAll.invalidate();
			onClose();
		},
		onError: (error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
		onSettled: () => {
			setIsLoading(false);
		}
	});

	useEffect(() => {
		if (activityId) {
			setIsLoading(true);
			utils.classActivity.getById.fetch(activityId)
				.then((activity) => {
					if (activity) {
						const config = activity.configuration as unknown as ActivityConfiguration;
						form.reset({
							title: activity.title,
							description: activity.description ?? "",
							type: activity.type as ActivityType,
							classId: activity.classId ?? undefined,
							subjectId: activity.subjectId,
							classGroupId: activity.classGroupId ?? undefined,
							configuration: {
								...config,
								availabilityDate: new Date(config.availabilityDate),
								deadline: new Date(config.deadline),
								instructions: config.instructions ?? "",
								timeLimit: config.timeLimit ?? undefined,
								attempts: config.attempts ?? undefined,
								autoGradingConfig: config.autoGradingConfig ?? undefined
							},
							resources: []
						});
					}
				})
				.catch((error) => {
					console.error('Error fetching activity:', error);
					toast({
						title: "Error",
						description: "Failed to load activity",
						variant: "destructive",
					});
				})
				.finally(() => {
					setIsLoading(false);
				});
		} else {
			setIsLoading(false);
		}
	}, [activityId, utils.classActivity, form, toast]);

	const onSubmit = async (data: FormData) => {
		try {
			if (activityId) {
				await updateMutation.mutateAsync({
					id: activityId,
					...data,
					classId: data.classId || "", // Ensure classId is never undefined
				});
			} else {
				await createMutation.mutateAsync(data);
			}
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Failed to save activity",
				variant: "destructive",
			});
		}
	};





	const isLoadingData = classesLoading || subjectsLoading || classGroupsLoading || isLoading;

	return (
		<div className="container max-w-4xl mx-auto py-8">
			{isLoadingData && <div>Loading...</div>}
			<div className="bg-card rounded-lg shadow">
				<div className="px-6 py-4 border-b">
					<h2 className="text-2xl font-bold">
						{activityId ? 'Edit Activity' : 'Create New Activity'}
					</h2>
				</div>

				<div className="p-6">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							{/* Basic Information */}
							<div className="space-y-4">
								<h3 className="text-lg font-medium">Basic Information</h3>
								<FormField
									control={form.control}
									name="title"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Title</FormLabel>
											<FormControl>
												<Input {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{/* Class and Subject Selection */}
							<div className="space-y-4">
								<h3 className="text-lg font-medium">Class and Subject</h3>
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="classId"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Class</FormLabel>
												<Select onValueChange={field.onChange} value={field.value}>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select class" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{classes?.map((cls: { id: string; name: string }) => (
															<SelectItem key={cls.id} value={cls.id}>
																{cls.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="subjectId"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Subject</FormLabel>
												<Select onValueChange={field.onChange} value={field.value}>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select subject" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{subjects?.map((subject: { id: string; name: string }) => (
															<SelectItem key={subject.id} value={subject.id}>
																{subject.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>

							{/* Activity Type and Configuration */}
							<div className="space-y-4">
								<h3 className="text-lg font-medium">Activity Settings</h3>
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="type"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Activity Type</FormLabel>
												<Select onValueChange={field.onChange} value={field.value}>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select type" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{Object.values(ActivityType).map((type) => (
															<SelectItem key={type} value={type}>
																{type.replace(/_/g, ' ')}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="configuration.activityMode"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Activity Mode</FormLabel>
												<Select onValueChange={field.onChange} value={field.value}>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select mode" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{Object.values(ActivityMode).map((mode) => (
															<SelectItem key={mode} value={mode}>
																{mode.replace(/_/g, ' ')}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Configuration Fields */}
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="configuration.totalMarks"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Total Marks</FormLabel>
												<FormControl>
													<Input 
														type="number" 
														{...field}
														onChange={(e) => field.onChange(Number(e.target.value))}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="configuration.passingMarks"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Passing Marks</FormLabel>
												<FormControl>
													<Input 
														type="number" 
														{...field}
														onChange={(e) => field.onChange(Number(e.target.value))}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="configuration.availabilityDate"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Start Date</FormLabel>
												<FormControl>
													<Input 
														type="datetime-local" 
														{...field}
														value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ''}
														onChange={(e) => field.onChange(new Date(e.target.value))}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="configuration.deadline"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Deadline</FormLabel>
												<FormControl>
													<Input 
														type="datetime-local" 
														{...field}
														value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ''}
														onChange={(e) => field.onChange(new Date(e.target.value))}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="configuration.instructions"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Instructions</FormLabel>
											<FormControl>
												<Textarea {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{/* Resources */}
							<ResourcesSection 
								form={form as unknown as UseFormReturn<{ resources?: Resource[] }> } 
							/>

							{/* Form Actions */}
							<div className="flex justify-end space-x-2 pt-6 border-t">
								<Button type="button" variant="outline" onClick={onClose}>
									Cancel
								</Button>
								<Button type="submit">
									{activityId ? "Update" : "Create"} Activity
								</Button>
							</div>
						</form>
					</Form>
				</div>
			</div>
		</div>
	);
}
