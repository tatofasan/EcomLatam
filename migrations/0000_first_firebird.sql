CREATE TYPE "public"."campaign_status" AS ENUM('active', 'paused', 'completed', 'draft');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('fixed', 'percentage', 'tiered');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('sale', 'hold', 'rejected', 'trash');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('active', 'inactive', 'pending_approval');--> statement-breakpoint
CREATE TYPE "public"."shopify_store_status" AS ENUM('active', 'inactive', 'error', 'pending');--> statement-breakpoint
CREATE TYPE "public"."traffic_source" AS ENUM('organic', 'paid', 'social', 'email', 'direct', 'referral');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'withdrawal', 'commission', 'bonus', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'moderator', 'finance');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TABLE "advertisers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"website" text,
	"status" text DEFAULT 'active',
	"commission_settings" json,
	"postback_url" text,
	"api_credentials" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"product_id" integer,
	"name" text NOT NULL,
	"description" text,
	"status" "campaign_status" DEFAULT 'draft',
	"budget" numeric(10, 2),
	"spent" numeric(10, 2) DEFAULT '0.00',
	"start_date" timestamp,
	"end_date" timestamp,
	"target_audience" json,
	"tracking_params" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "click_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"campaign_id" integer,
	"product_id" integer,
	"click_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"referrer_url" text,
	"landing_page" text,
	"country" text,
	"device" text,
	"browser" text,
	"os" text,
	"is_bot" boolean DEFAULT false,
	"is_converted" boolean DEFAULT false,
	"conversion_time" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "click_tracking_click_id_unique" UNIQUE("click_id")
);
--> statement-breakpoint
CREATE TABLE "lead_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"product_name" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"price" numeric(10, 2),
	"total" numeric(10, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_number" text NOT NULL,
	"user_id" integer,
	"campaign_id" integer,
	"product_id" integer,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text NOT NULL,
	"customer_address" text,
	"customer_city" text,
	"customer_country" text,
	"status" "lead_status" DEFAULT 'hold',
	"quality" text DEFAULT 'standard',
	"value" numeric(10, 2),
	"commission" numeric(10, 2),
	"ip_address" text,
	"user_agent" text,
	"referrer_url" text,
	"landing_page" text,
	"utm_term" text,
	"utm_content" text,
	"click_id" text,
	"sub_id" text,
	"publisher_id" text,
	"subacc1" text,
	"subacc2" text,
	"subacc3" text,
	"subacc4" text,
	"conversion_time" timestamp,
	"conversion_value" numeric(10, 2),
	"is_converted" boolean DEFAULT false,
	"postback_sent" boolean DEFAULT false,
	"notes" text,
	"custom_fields" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "leads_lead_number_unique" UNIQUE("lead_number")
);
--> statement-breakpoint
CREATE TABLE "performance_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"campaign_id" integer,
	"product_id" integer,
	"date" timestamp NOT NULL,
	"clicks" integer DEFAULT 0,
	"leads" integer DEFAULT 0,
	"sales" integer DEFAULT 0,
	"revenue" numeric(10, 2) DEFAULT '0.00',
	"commission" numeric(10, 2) DEFAULT '0.00',
	"conversion_rate" numeric(5, 2) DEFAULT '0.00',
	"cost_per_lead" numeric(10, 2) DEFAULT '0.00',
	"roi" numeric(5, 2) DEFAULT '0.00',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "postbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"advertiser_id" integer,
	"url" text NOT NULL,
	"method" text DEFAULT 'GET',
	"payload" json,
	"response" json,
	"status" text DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"last_attempt" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2),
	"image_url" text,
	"category" text,
	"stock" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"sku" text NOT NULL,
	"additional_images" text[],
	"weight" numeric(10, 2),
	"dimensions" text,
	"specifications" json,
	"reference" text,
	"provider" text,
	"user_id" integer,
	"payout_po" numeric(10, 2) DEFAULT '0',
	"trending" boolean DEFAULT false,
	"vertical" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "shopify_stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"shop" text NOT NULL,
	"access_token" text NOT NULL,
	"status" "shopify_store_status" DEFAULT 'pending',
	"scopes" text,
	"installed_at" timestamp DEFAULT now(),
	"uninstalled_at" timestamp,
	"settings" json,
	"webhook_ids" json,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "shopify_stores_shop_unique" UNIQUE("shop")
);
--> statement-breakpoint
CREATE TABLE "terms_and_conditions" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"effective_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "terms_and_conditions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"lead_id" integer,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "transaction_status" DEFAULT 'pending',
	"description" text,
	"payment_method" text,
	"payment_proof" text,
	"reference" text,
	"fees" numeric(10, 2) DEFAULT '0.00',
	"net_amount" numeric(10, 2),
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'user',
	"status" "user_status" DEFAULT 'pending',
	"api_key" text,
	"commission_rate" numeric(5, 2) DEFAULT '0.00',
	"referral_code" text,
	"country" text,
	"phone" text,
	"payment_methods" json,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"verification_token" text,
	"verification_expires" timestamp,
	"is_email_verified" boolean DEFAULT false,
	"settings" json,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_api_key_unique" UNIQUE("api_key"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_tracking" ADD CONSTRAINT "click_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_tracking" ADD CONSTRAINT "click_tracking_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_tracking" ADD CONSTRAINT "click_tracking_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_items" ADD CONSTRAINT "lead_items_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reports" ADD CONSTRAINT "performance_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reports" ADD CONSTRAINT "performance_reports_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reports" ADD CONSTRAINT "performance_reports_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postbacks" ADD CONSTRAINT "postbacks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postbacks" ADD CONSTRAINT "postbacks_advertiser_id_advertisers_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."advertisers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_stores" ADD CONSTRAINT "shopify_stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;