'use client'

import { useState, ReactNode } from 'react';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { api } from "@/utils/api";
import { TeacherProfile, Period as PrismaPeriod, Classroom } from "@prisma/client";
import { PeriodDialog } from "./PeriodDialog";
import { PeriodInput } from "@/types/timetable";


type PeriodWithRelations = PrismaPeriod & {
	subject: { name: string };
	teacher: TeacherProfile & { 
		user: { name: string | null } 
	};
	classroom: Classroom;
	timetable: {
		class: {
			name: string;
		};
	};
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => {
	const hour = Math.floor(i / 2) + 8;
	const minute = i % 2 === 0 ? "00" : "30";
	return `${hour.toString().padStart(2, "0")}:${minute}`;
});

export default function TimetableView({ timetableId }: { timetableId: string }) {
	const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
	const [selectedDay, setSelectedDay] = useState(1);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [selectedPeriod, setSelectedPeriod] = useState<Partial<PeriodInput> | undefined>(undefined);

	const { data: timetable, isLoading } = api.timetable.getById.useQuery(timetableId);
	const utils = api.useContext();

	if (isLoading) return <div>Loading...</div>;
	if (!timetable) return <div>Timetable not found</div>;

	const periodsByDay = timetable.periods.reduce<Record<number, PeriodWithRelations[]>>((acc, period: any) => {
		const day = period.dayOfWeek;
		if (!acc[day]) acc[day] = [];
		acc[day].push(period);
		return acc;
	}, {});

	const getPeriodsForTimeSlot = (day: number, timeSlot: string) => {
		return periodsByDay?.[day]?.filter(period => {
			const periodStart = period.startTime.toISOString().slice(11, 16);
			const periodEnd = period.endTime.toISOString().slice(11, 16);
			return timeSlot >= periodStart && timeSlot < periodEnd;
		});
	};

	const handlePeriodSave = () => {
		utils.timetable.getById.invalidate(timetableId);
		setIsDialogOpen(false);
		setSelectedPeriod(undefined);
	};

	const handleAddPeriod = () => {
		setSelectedPeriod(undefined);
		setIsDialogOpen(true);
	};

	const handleEditPeriod = (period: PeriodWithRelations) => {
		setSelectedPeriod({
			startTime: period.startTime.toISOString().slice(11, 16),
			endTime: period.endTime.toISOString().slice(11, 16),
			dayOfWeek: period.dayOfWeek,
			durationInMinutes: Math.round((period.endTime.getTime() - period.startTime.getTime()) / 60000),
			teacherId: period.teacherId,
			classroomId: period.classroomId,
			subjectId: period.subjectId
		});
		setIsDialogOpen(true);
	};

	const renderPeriodCard = (period: PeriodWithRelations): ReactNode => (
		<Card 
			key={period.id} 
			className="p-3 bg-primary/5 hover:bg-primary/10 transition-colors border-l-4 border-l-primary cursor-pointer"
			onClick={() => handleEditPeriod(period)}
		>
			<div className="flex justify-between items-start">
				<div>
					<div className="text-sm font-semibold text-primary">
						{period.subject.name}
					</div>
					<div className="text-xs text-muted-foreground mt-1">
						{period.teacher.user.name ?? 'Unknown'} - Room {period.classroom.name}
					</div>
				</div>
				<div className="text-xs text-muted-foreground">
					{period.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
					{period.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
				</div>
			</div>
		</Card>
	);

	const renderDayView = (): ReactNode => (
		<div className="grid grid-cols-1 gap-2">
			{TIME_SLOTS.map((timeSlot) => {
				const periods = getPeriodsForTimeSlot(selectedDay, timeSlot);
				return (
					<div key={timeSlot} className="flex group">
						<div className="w-20 py-2 text-sm text-muted-foreground font-medium">
							{timeSlot}
						</div>
						<div className="flex-1 pl-4 min-h-[3rem] border-l group-hover:border-l-primary">
							{periods?.map(renderPeriodCard)}
						</div>
					</div>
				);
			})}
		</div>
	);

	const renderWeekView = (): ReactNode => (
		<div className="grid grid-cols-6 gap-4">
			<div className="col-span-1">
				<div className="h-10" /> {/* Header spacer */}
				{TIME_SLOTS.map(slot => (
					<div key={slot} className="h-24 text-sm text-muted-foreground p-2">
						{slot}
					</div>
				))}
			</div>
			{DAYS.map((day, index) => (
				<div key={day} className="col-span-1">
					<div className="h-10 font-semibold text-center">{day}</div>
					{TIME_SLOTS.map(slot => {
						const periods = getPeriodsForTimeSlot(index + 1, slot);
						return (
							<div key={slot} className="h-24 border-l p-2">
								{periods?.map(renderPeriodCard)}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-2xl font-bold">
					{timetable.class?.name || timetable.classGroup?.name} Timetable
				</h2>
				<div className="flex items-center gap-4">
					<Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'day' | 'week')}>
						<TabsList>
							<TabsTrigger value="day">Day View</TabsTrigger>
							<TabsTrigger value="week">Week View</TabsTrigger>
						</TabsList>
					</Tabs>
					{viewMode === 'day' && (
						<Select value={selectedDay.toString()} onValueChange={(value) => setSelectedDay(parseInt(value))}>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DAYS.map((day, index) => (
									<SelectItem key={index + 1} value={(index + 1).toString()}>
										{day}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					<Button onClick={handleAddPeriod}>
						Add Period
					</Button>
				</div>
			</div>

			{viewMode === 'day' ? renderDayView() : renderWeekView()}

			<PeriodDialog
				isOpen={isDialogOpen}
				onClose={() => setIsDialogOpen(false)}
				onSave={handlePeriodSave}
				period={selectedPeriod}
				timetableId={timetableId}
				breakTimes={[]}
			/>

		</div>
	);
}