import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
} from "./command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "./popover";

interface MultiSelectProps {
	options: { label: string; value: number }[];
	value: number[];
	onChange: (value: number[]) => void;
	placeholder?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "Select options..." }: MultiSelectProps) {
	const [open, setOpen] = React.useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" className="w-full justify-start">
					{value.length > 0
						? value.map(v => options.find(opt => opt.value === v)?.label).join(", ")
						: placeholder}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[200px] p-0">
				<Command>
					<CommandGroup>
						{options.map((option) => (
							<CommandItem
								key={option.value}
								onSelect={() => {
									const newValue = value.includes(option.value)
										? value.filter(v => v !== option.value)
										: [...value, option.value];
									onChange(newValue);
								}}
							>
								<Check
									className={cn(
										"mr-2 h-4 w-4",
										value.includes(option.value) ? "opacity-100" : "opacity-0"
									)}
								/>
								{option.label}
							</CommandItem>
						))}
					</CommandGroup>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
