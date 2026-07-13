CREATE TABLE `microblogs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`content_markdown` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`cover_image_url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `microblogs_slug_unique` ON `microblogs` (`slug`);