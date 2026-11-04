CREATE TABLE "recovery_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" bigint
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"last_seen_at" bigint NOT NULL,
	"user_agent" text,
	"scope" text DEFAULT 'full' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint NOT NULL,
	"transports" text NOT NULL,
	"device_name" text,
	"created_at" bigint NOT NULL,
	"last_used_at" bigint,
	"revoked_at" bigint
);
--> statement-breakpoint
CREATE TABLE "meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_log" (
	"id" text PRIMARY KEY NOT NULL,
	"widget_id" text NOT NULL,
	"action" text NOT NULL,
	"params" text NOT NULL,
	"result" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_points" (
	"source_id" text NOT NULL,
	"metric" text NOT NULL,
	"ts" bigint NOT NULL,
	"value" double precision NOT NULL,
	"dims" text
);
--> statement-breakpoint
CREATE INDEX "metric_points_source_metric_ts_idx" ON "metric_points" USING btree ("source_id","metric","ts");--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"source_id" text NOT NULL,
	"key" text NOT NULL,
	"payload" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	"expires_at" bigint,
	"status" text NOT NULL,
	"error" text,
	CONSTRAINT "source_snapshots_source_id_key_pk" PRIMARY KEY("source_id","key")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"body" text NOT NULL,
	"inputs_hash" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "widget_layout" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"layout" text NOT NULL,
	"updated_at" bigint NOT NULL
);
