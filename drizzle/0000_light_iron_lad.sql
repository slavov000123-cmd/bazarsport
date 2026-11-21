CREATE TABLE `editorial_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `editorial_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`reference_id` text,
	`created_by` text NOT NULL,
	`approved_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`revision` integer DEFAULT 1 NOT NULL
);
