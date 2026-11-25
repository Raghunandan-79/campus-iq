import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "student",
  "moderator",
  "admin",
]);

export const resourceTypeEnum = pgEnum("resource_type", [
  "notes",
  "pyq",
  "syllabus",
  "revision",
  "solved",
  "link",
  "other",
]);

export const visibilityEnum = pgEnum("visibility", [
  "campus",
  "college",
  "restricted",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "ready",
  "failed",
]);

export const voteTypeEnum = pgEnum("vote_type", ["upvote", "downvote"]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "visible",
  "hidden",
  "removed",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "resolved",
  "dismissed",
]);

export const reportTargetTypeEnum = pgEnum("report_target_type", [
  "resource",
  "resource_review",
  "college_review",
]);

export const colleges = pgTable(
  "colleges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    domain: varchar("domain", { length: 255 }),
    location: varchar("location", { length: 200 }),
    website: varchar("website", { length: 500 }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("colleges_domain_unique").on(t.domain)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    collegeId: uuid("college_id").references(() => colleges.id, {
      onDelete: "set null",
    }),
    role: userRoleEnum("role").notNull().default("student"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 50 }),
    semester: integer("semester"),
    description: text("description"),
    collegeId: uuid("college_id").references(() => colleges.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("subjects_college_idx").on(t.collegeId)],
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    resourceType: resourceTypeEnum("resource_type").notNull(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id, { onDelete: "restrict" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 500 }).unique(),
    originalFilename: varchar("original_filename", { length: 500 }),
    mimeType: varchar("mime_type", { length: 120 }),
    fileSize: bigint("file_size", { mode: "number" }),
    url: varchar("url", { length: 1000 }),
    batchYear: integer("batch_year"),
    semester: integer("semester"),
    visibility: visibilityEnum("visibility").notNull().default("campus"),
    uploadStatus: uploadStatusEnum("upload_status")
      .notNull()
      .default("pending"),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("visible"),
    downloadCount: integer("download_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("resources_subject_idx").on(t.subjectId),
    index("resources_college_idx").on(t.collegeId),
    index("resources_uploader_idx").on(t.uploadedBy),
    index("resources_type_idx").on(t.resourceType),
    index("resources_created_idx").on(t.createdAt),
    index("resources_batch_idx").on(t.batchYear),
  ],
);

export const resourceVotes = pgTable(
  "resource_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    voteType: voteTypeEnum("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("resource_votes_unique").on(t.resourceId, t.userId),
    index("resource_votes_resource_idx").on(t.resourceId),
  ],
);

export const resourceReviews = pgTable(
  "resource_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentReviewId: uuid("parent_review_id"),
    content: text("content").notNull(),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("visible"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("resource_reviews_resource_idx").on(t.resourceId),
    index("resource_reviews_parent_idx").on(t.parentReviewId),
  ],
);

export const reviewVotes = pgTable(
  "review_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => resourceReviews.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    voteType: voteTypeEnum("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("review_votes_unique").on(t.reviewId, t.userId),
    index("review_votes_review_idx").on(t.reviewId),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("bookmarks_unique").on(t.resourceId, t.userId)],
);

export const collegeReviews = pgTable(
  "college_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    overallRating: integer("overall_rating").notNull(),
    academicsRating: integer("academics_rating").notNull(),
    facultyRating: integer("faculty_rating").notNull(),
    infrastructureRating: integer("infrastructure_rating").notNull(),
    campusLifeRating: integer("campus_life_rating").notNull(),
    placementsRating: integer("placements_rating").notNull(),
    administrationRating: integer("administration_rating").notNull(),
    content: text("content"),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("visible"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("college_reviews_unique").on(t.collegeId, t.userId),
    index("college_reviews_college_idx").on(t.collegeId),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: reportTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

export const moderationLogs = pgTable(
  "moderation_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: reportTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("moderation_logs_target_idx").on(t.targetType, t.targetId)],
);

export const collegeRequestStatusEnum = pgEnum("college_request_status", [
  "pending",
  "approved",
  "dismissed",
]);

export const collegeRequests = pgTable(
  "college_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    location: varchar("location", { length: 200 }),
    website: varchar("website", { length: 500 }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: collegeRequestStatusEnum("status").notNull().default("pending"),
    createdCollegeId: uuid("created_college_id").references(() => colleges.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("college_requests_status_idx").on(t.status)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const schema = {
  colleges,
  users,
  subjects,
  resources,
  resourceVotes,
  resourceReviews,
  reviewVotes,
  bookmarks,
  collegeReviews,
  reports,
  moderationLogs,
  collegeRequests,
  sessions,
};
