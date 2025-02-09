import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/utils/api";
import { PeriodInput, periodInputSchema } from "@/types/timetable";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, Clock } from "lucide-react";

interface PeriodDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (period: PeriodInput) => void;
	breakTimes: { startTime: string; endTime: string; dayOfWeek: number }[];
	period?: Partial<PeriodInput>;
	timetableId: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function PeriodDialog({ isOpen, onClose, onSave, breakTimes, period, timetableId }: PeriodDialogProps) {
	const form = useForm<PeriodInput>({
		resolver: zodResolver(periodInputSchema),
		defaultValues: {
			startTime: period?.startTime ?? "",
			endTime: period?.endTime ?? "",
			dayOfWeek: period?.dayOfWeek ?? 1,
			durationInMinutes: period?.durationInMinutes ?? 45,
			teacherId: period?.teacherId ?? "",
			classroomId: period?.classroomId ?? "",
			subjectId: period?.subjectId ?? ""
		}
	});

	const { data: teachers } = api.teacher.searchTeachers.useQuery({ search: "" });
	const { data: classrooms } = api.classroom.list.useQuery();
	const { data: subjects } = api.subject.list.useQuery();
	const { mutateAsync: checkAvailability } = api.timetable.checkAvailability.useMutation();

	const onSubmit = async (data: PeriodInput) => {
		try {
			const startTime = new Date(`1970-01-01T${data.startTime}`);
			const endTime = new Date(`1970-01-01T${data.endTime}`);
			const durationInMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
			
			const updatedData = {
				...data,
				durationInMinutes
			};

			const availability = await checkAvailability({
				period: updatedData,
				breakTimes
			});

			if (!availability.isAvailable) {
				const conflictMessages = availability.conflicts.map(conflict => {
					const { startTime, endTime } = conflict.details;
					switch (conflict.type) {
						case 'TEACHER':
							return `Teacher is not available at ${startTime} - ${endTime}`;
						case 'CLASSROOM':
							return `Classroom is booked for ${startTime} - ${endTime}`;
						case 'BREAK_TIME':
							return `Period overlaps with break time: ${startTime} - ${endTime}`;
						default:
							return 'Scheduling conflict detected';
					}
				});

				toast({
					title: "Scheduling Conflict",
					description: conflictMessages.join('\n'),
					variant: "destructive"
				});
				return;
			}

			onSave(updatedData);
			onClose();
			toast({
				title: "Success",
				description: "Period scheduled successfully",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to validate schedule",
				variant: "destructive"
			});
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{period ? 'Edit Period' : 'Add New Period'}</DialogTitle>
					<DialogDescription>
						Schedule a new class period. All fields are required.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="startTime"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Start Time</FormLabel>
										<FormControl>
											<Input type="time" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="endTime"
								render={({ field }) => (
									<FormItem>
										<FormLabel>End Time</FormLabel>
										<FormControl>
											<Input type="time" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="dayOfWeek"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Day of Week</FormLabel>
									<Select
										value={field.value.toString()}
										onValueChange={(value) => field.onChange(parseInt(value))}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select a day" />
										</SelectTrigger>
										<SelectContent>
											{DAYS.map((day, index) => (
												<SelectItem key={index + 1} value={(index + 1).toString()}>
													{day}
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
							name="teacherId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Teacher</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger>
											<SelectValue placeholder="Select a teacher" />
										</SelectTrigger>
										<SelectContent>
											{teachers?.map((teacher) => (
												<SelectItem key={teacher.id} value={teacher.id}>
													{teacher.name ?? 'Unknown'}
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
							name="classroomId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Classroom</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger>
											<SelectValue placeholder="Select a classroom" />
										</SelectTrigger>
										<SelectContent>
											{classrooms?.map((classroom) => (
												<SelectItem key={classroom.id} value={classroom.id}>
													{classroom.name}
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
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger>
											<SelectValue placeholder="Select a subject" />
										</SelectTrigger>
										<SelectContent>
											{subjects?.map((subject) => (
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

						{breakTimes.length > 0 && (
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									Break times are scheduled for this day. Please ensure your period doesn't overlap.
								</AlertDescription>
							</Alert>
						)}

						<div className="flex justify-end space-x-2">
							<Button variant="outline" onClick={onClose}>
								Cancel
							</Button>
							<Button type="submit">
								{period ? 'Update Period' : 'Add Period'}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}