'use client';

import { useForm } from "react-hook-form";
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
import { ActivityType, ActivityMode, ActivityGradingType, ActivityViewType } from "@prisma/client";
import { useEffect } from "react";



const formSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	classId: z.string().optional(),
	subjectId: z.string().min(1, "Subject is required"),
	type: z.nativeEnum(ActivityType),
	configuration: z.object({
		activityMode: z.nativeEnum(ActivityMode),
		isGraded: z.boolean(),
		totalMarks: z.number().min(1, "Total marks must be greater than 0"),
		passingMarks: z.number().min(1, "Passing marks must be greater than 0"),
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
		}).optional(),
	}),
	resources: z.array(z.object({
		title: z.string(),
		type: z.string(),
		url: z.string(),
		fileInfo: z.object({
			size: z.number(),
			createdAt: z.date(),
			updatedAt: z.date(),
			mimeType: z.string(),
			publicUrl: z.string()
		}).optional()
	})).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
	activityId?: string;
	onClose: () => void;
}

export default function ClassActivityForm({ activityId, onClose }: Props) {
	const { toast } = useToast();
	const utils = api.useContext();
	const { data: classes } = api.class.getAll.useQuery();
	const { data: subjects } = api.subject.getByClass.useQuery(
		{ classId: form.watch('classId') || "" },
		{ enabled: !!form.watch('classId') }
	);



	const form = useForm<FormData>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: "",
			description: "",
			type: ActivityType.CLASS_ASSIGNMENT,
			configuration: {
				activityMode: ActivityMode.IN_CLASS,
				isGraded: true,
				totalMarks: 100,
				passingMarks: 40,
				gradingType: ActivityGradingType.MANUAL,
				availabilityDate: new Date(),
				deadline: new Date(),
				viewType: ActivityViewType.STUDENT,
			},
			resources: [],
		},
	});



	const { data: activity } = api.classActivity.getById.useQuery(activityId as string, {
		enabled: !!activityId,
	});

	const createMutation = api.classActivity.create.useMutation({
		onSuccess: () => {
			utils.classActivity.getAll.invalidate();
		},
		onError: (error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const updateMutation = api.classActivity.update.useMutation({
		onSuccess: () => {
			utils.classActivity.getAll.invalidate();
		},
		onError: (error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		if (activity) {
			form.reset({
				title: activity.title,
				description: activity.description || "",
				type: activity.type as ActivityType,
				deadline: activity.deadline?.toISOString().split('T')[0],
				gradingCriteria: activity.gradingCriteria || "",
				classId: activity.classId || "",
				classGroupId: activity.classGroupId || "",
				subjectId: activity.subjectId,
				resources: activity.resources || []
			});
		}
	}, [activity, form]);

	const onSubmit = (data: FormData) => {
		if (!data.classId) {
			toast({
				title: "Error",
				description: "Class is required",
				variant: "destructive",
			});
			return;
		}

		if (!data.subjectId) {
			toast({
				title: "Error",
				description: "Subject is required",
				variant: "destructive",
			});
			return;
		}

		const formData = {
			title: data.title,
			description: data.description,
			type: data.type,
			classId: data.classId,
			subjectId: data.subjectId,
			deadline: data.deadline ? new Date(data.deadline) : undefined,
			gradingCriteria: data.gradingCriteria,
			configuration: data.configuration,
			resources: data.resources,
		};

		if (activityId) {
			updateMutation.mutate({
				id: activityId,
				...formData
			});
		} else {
			createMutation.mutate(formData);
		}

	};

	const handleResourceUpload = (resource: Resource, index: number, filePath: string, fileInfo: any) => {
		const newResources = [...(form.getValues('resources') || [])];
		newResources[index] = {
			...resource,
			url: filePath,
			fileInfo: {
				size: fileInfo.size,
				createdAt: new Date(fileInfo.createdAt),
				updatedAt: new Date(fileInfo.updatedAt),
				mimeType: fileInfo.mimeType,
				publicUrl: fileInfo.publicUrl,
			},
		};
		form.setValue('resources', newResources);
	};

	return (
		<div className="max-w-3xl mx-auto p-6">
			<h2 className="text-2xl font-bold mb-6">{activityId ? 'Edit Activity' : 'Create New Activity'}</h2>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

				<FormField
					control={form.control}
					name="type"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Type</FormLabel>
							<Select onValueChange={field.onChange} value={field.value ?? ActivityTypes.CLASS_ASSIGNMENT}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select activity type" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{Object.entries(ActivityTypes)
										.filter(([_, value]) => !!value)
										.map(([key, value]) => (
											<SelectItem key={key} value={value}>
												{key.replace(/_/g, ' ')}
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
							<Select 
								onValueChange={(value) => {
									field.onChange(value);
									form.setValue('configuration.gradingType', 
										value === 'ONLINE' ? 'AUTOMATIC' : 'MANUAL'
									);
								}} 
								value={field.value}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select activity mode" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="ONLINE">Online</SelectItem>
									<SelectItem value="IN_CLASS">In Class</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

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
									onChange={e => field.onChange(Number(e.target.value))}
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
									onChange={e => field.onChange(Number(e.target.value))}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="configuration.isGraded"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Is Graded</FormLabel>
							<Select 
								onValueChange={(value) => field.onChange(value === 'true')} 
								value={field.value.toString()}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select grading status" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="true">Yes</SelectItem>
									<SelectItem value="false">No</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="deadline"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Deadline</FormLabel>
							<FormControl>
								<Input type="date" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="classGroupId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Class Group</FormLabel>
							<Select onValueChange={field.onChange} value={field.value ?? ""}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select class group" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{classGroups
										?.filter(group => !!group.id)
										.map((group) => (
											<SelectItem key={group.id} value={group.id}>
												{group.name}
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
							<Select onValueChange={field.onChange} value={field.value ?? ""}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select subject" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{subjects
										?.filter(subject => !!subject.id)
										.map((subject) => (
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

				<FormField
					control={form.control}
					name="classId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Class</FormLabel>
							<Select onValueChange={field.onChange} value={field.value ?? ""}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select class" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{classes
										?.filter(cls => !!cls.id)
										.map((cls) => (
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
					name="gradingCriteria"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Grading Criteria</FormLabel>
							<FormControl>
								<Textarea {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="resources"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Resources</FormLabel>
							<div className="space-y-2">
								{field.value?.map((resource, index) => (
									<div key={index} className="space-y-2">
										<div className="flex items-center space-x-2">
											<Input
												value={resource.title}
												onChange={(e) => {
													const newResources = [...field.value!];
													newResources[index].title = e.target.value;
													field.onChange(newResources);
												}}
												placeholder="Resource title"
											/>
											<Select
												value={resource.type ?? ResourceType.DOCUMENT}
												onValueChange={(value) => {
													const newResources = [...field.value!];
													newResources[index].type = value as ResourceType;
													field.onChange(newResources);
												}}
											>
												<SelectTrigger className="w-[150px]">
													<SelectValue placeholder="Type" />
												</SelectTrigger>
												<SelectContent>
													{Object.values(ResourceType)
														.filter(type => !!type)
														.map((type) => (
															<SelectItem key={type} value={type}>
																{type}
															</SelectItem>
														))}
												</SelectContent>
											</Select>
											{resource.fileInfo ? (
												<div className="flex items-center space-x-2">
													<span className="text-sm text-muted-foreground">
														{(resource.fileInfo.size / 1024 / 1024).toFixed(2)}MB
													</span>
													<Button
														type="button"
														variant="destructive"
														size="sm"
														onClick={() => {
															const newResources = [...field.value!];
															newResources[index].fileInfo = undefined;
															newResources[index].url = '';
															field.onChange(newResources);
														}}
													>
														Remove File
													</Button>
												</div>
											) : (
												<div className="flex-1">
													<FileUpload
														subDir={`activity-resources/${activity?.id || 'new'}`}
														onUploadComplete={(filePath, fileInfo) => 
															handleResourceUpload(resource, index, filePath, fileInfo)
														}
														allowedTypes={['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
													/>

												</div>
											)}
											<Button
												type="button"
												variant="destructive"
												size="sm"
												onClick={() => {
													const newResources = field.value?.filter((_, i) => i !== index);
													field.onChange(newResources);
												}}
											>
												Remove
											</Button>
										</div>
									</div>
								))}
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										const newResources = [
											...(field.value || []),
											{ title: "", type: ResourceType.DOCUMENT, url: "" },
										];
										field.onChange(newResources);
									}}
								>
									Add Resource
								</Button>
							</div>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex justify-end space-x-2">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit">
						{activityId ? "Update" : "Create"} Activity
					</Button>
				</div>
			</form>
		</Form>
	</DialogContent>
);
}