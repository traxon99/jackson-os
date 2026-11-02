CREATE TABLE `action_log` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_id` text NOT NULL,
	`action` text NOT NULL,
	`params` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metric_points` (
	`source_id` text NOT NULL,
	`metric` text NOT NULL,
	`ts` integer NOT NULL,
	`value` real NOT NULL,
	`dims` text
);
--> statement-breakpoint
CREATE INDEX `metric_points_source_metric_ts_idx` ON `metric_points` (`source_id`,`metric`,`ts`);--> statement-breakpoint
CREATE TABLE `source_snapshots` (
	`source_id` text NOT NULL,
	`key` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`expires_at` integer,
	`status` text NOT NULL,
	`error` text,
	PRIMARY KEY(`source_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`body` text NOT NULL,
	`inputs_hash` text NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `widget_layout` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`layout` text NOT NULL,
	`updated_at` integer NOT NULL
);
