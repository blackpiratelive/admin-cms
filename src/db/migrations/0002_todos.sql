CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_name_unique` ON `projects` (`name`);
--> statement-breakpoint
CREATE TABLE `todos` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `due_date` text,
  `priority` text DEFAULT 'medium' NOT NULL,
  `completed` integer DEFAULT 0 NOT NULL,
  `project_id` text,
  `tags` text DEFAULT '[]' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
