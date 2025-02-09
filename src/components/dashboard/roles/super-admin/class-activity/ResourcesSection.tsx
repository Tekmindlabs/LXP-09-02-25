import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/ui/file-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { ActivityResourceType } from "@prisma/client";

interface ResourcesSectionProps {
	form: UseFormReturn<any>;
}

export function ResourcesSection({ form }: ResourcesSectionProps) {
	const resources = form.watch('resources') || [];

	const handleAddResource = () => {
		const currentResources = form.getValues('resources') || [];
		form.setValue('resources', [
			...currentResources,
			{ title: '', type: ActivityResourceType.DOCUMENT, url: '' }
		]);
	};

	const handleRemoveResource = (index: number) => {
		const currentResources = form.getValues('resources') || [];
		form.setValue('resources', currentResources.filter((_, i) => i !== index));
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-medium">Resources</h3>
				<Button type="button" variant="outline" onClick={handleAddResource}>
					Add Resource
				</Button>
			</div>

			{resources.map((_, index) => (
				<div key={index} className="space-y-4 p-4 border rounded-md">
					<div className="flex justify-end">
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={() => handleRemoveResource(index)}
						>
							Remove
						</Button>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name={`resources.${index}.title`}
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
							name={`resources.${index}.type`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Type</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{Object.values(ActivityResourceType).map((type) => (
												<SelectItem key={type} value={type}>
													{type}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<FormField
						control={form.control}
						name={`resources.${index}.url`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{field.value ? 'URL/File' : 'Upload File or Enter URL'}
								</FormLabel>
								<FormControl>
									{field.value ? (
										<div className="flex gap-2">
											<Input {...field} />
											<Button
												type="button"
												variant="outline"
												onClick={() => field.onChange('')}
											>
												Clear
											</Button>
										</div>
									) : (
										<FileUpload
											endpoint="resourceUploader"
											onClientUploadComplete={(res) => {
												if (res?.[0]) {
													field.onChange(res[0].url);
													form.setValue(`resources.${index}.fileInfo`, {
														size: res[0].size,
														createdAt: new Date(),
														updatedAt: new Date(),
														mimeType: res[0].mimeType,
														publicUrl: res[0].url
													});
												}
											}}
											onUploadError={(error: Error) => {
												console.error(error);
											}}
										/>
									)}
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			))}
		</div>
	);
}