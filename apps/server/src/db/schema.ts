import {
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: varchar('github_id', { length: 64 }).unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 255 }).notNull().default('未命名'),
  thumbnailKey: text('thumbnail_key'),
  schemaVersion: integer('schema_version').notNull().default(1),
  snapshotKey: text('snapshot_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const shareLinks = pgTable('share_links', {
  token: varchar('token', { length: 32 }).primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id),
  mode: varchar('mode', { length: 8 }).notNull().$type<'view' | 'edit'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id),
  pageId: varchar('page_id', { length: 32 }).notNull(),
  elementId: varchar('element_id', { length: 32 }),
  worldX: real('world_x').notNull(),
  worldY: real('world_y').notNull(),
  authorId: uuid('author_id').references(() => users.id),
  authorName: varchar('author_name', { length: 255 }),
  body: text('body').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  mime: varchar('mime', { length: 128 }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  s3Key: text('s3_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type Comment = typeof comments.$inferSelect;
