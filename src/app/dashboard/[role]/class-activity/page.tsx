'use client';

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { api } from "@/utils/api";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { ActivityType, ActivityStatus } from "@prisma/client";
import { formatDate } from "@/lib/utils";

interface Props {
	params: {
		role: string;
	};
}

type Activity = {
	id: string;
	title: string;
	type: ActivityType;
	status: ActivityStatus;
	deadline: Date | null;
	class: { name: string } | null;
	subject: { name: string };
};

const columns: ColumnDef<Activity>[] = [
	{
		accessorKey: "title",
		header: "Title",
	},
	{
		accessorKey: "type",
		header: "Type",
		cell: ({ row }) => {
			return row.original.type.replace(/_/g, ' ');
		},
	},
	{
		accessorKey: "class.name",
		header: "Class",
	},
	{
		accessorKey: "subject.name",
		header: "Subject",
	},
	{
		accessorKey: "status",
		header: "Status",
	},
	{
		accessorKey: "deadline",
		header: "Deadline",
		cell: ({ row }) => {
			return row.original.deadline ? formatDate(row.original.deadline) : '-';
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			const router = useRouter();
			return (
				<Button
					variant="outline"
					onClick={() => router.push(`/dashboard/${params.role}/class-activity/${row.original.id}/edit`)}
				>
					Edit
				</Button>
			);
		},
	},
];

export default function ClassActivityPage({ params }: Props) {
	const router = useRouter();
	const { data: activities, isLoading } = api.classActivity.getAll.useQuery();

	return (
		<div className="container mx-auto py-8">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-bold">Class Activities</h1>
				<Button 
					onClick={() => router.push(`/dashboard/${params.role}/class-activity/create`)}
				>
					Create Activity
				</Button>
			</div>

			<div className="bg-white rounded-lg shadow">
				{isLoading ? (
					<div className="p-8 text-center">Loading...</div>
				) : (
					<DataTable 
						columns={columns} 
						data={activities || []} 
					/>
				)}
			</div>
		</div>
	);
}