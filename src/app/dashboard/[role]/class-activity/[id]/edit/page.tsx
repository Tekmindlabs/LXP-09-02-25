'use client';

import ClassActivityForm from "@/components/dashboard/roles/super-admin/class-activity/ClassActivityForm";
import { useRouter } from "next/navigation";

interface Props {
	params: {
		id: string;
		role: string;
	};
}

export default function EditClassActivityPage({ params }: Props) {
	const router = useRouter();

	return (
		<div>
			<ClassActivityForm 
				activityId={params.id}
				onClose={() => router.push(`/dashboard/${params.role}/class-activity`)} 
			/>
		</div>
	);
}