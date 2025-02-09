'use client';

import ClassActivityForm from "@/components/dashboard/roles/super-admin/class-activity/ClassActivityForm";
import { useRouter } from "next/navigation";

interface Props {
	params: {
		role: string;
	};
}

export default function CreateClassActivityPage({ params }: Props) {
	const router = useRouter();

	return (
		<div className="container mx-auto py-8">
			<ClassActivityForm 
				onClose={() => router.push(`/dashboard/${params.role}/class-activity`)} 
			/>
		</div>
	);
}