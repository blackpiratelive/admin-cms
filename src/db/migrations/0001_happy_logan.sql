CREATE TABLE `related_microblogs` (
	`microblog_id` text NOT NULL,
	`related_microblog_id` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`microblog_id`, `related_microblog_id`)
);
--> statement-breakpoint
ALTER TABLE `microblogs` ADD `images` text DEFAULT '[]' NOT NULL;