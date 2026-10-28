import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const songs = pgTable("songs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull().default("Unknown Artist"),
  genre: text("genre").notNull().default("Electronic"),
  mood: text("mood").notNull().default("Night"),
  accent: text("accent").notNull().default("#35e0ff"),
  duration: real("duration").notNull().default(0),
  audioUrl: text("audio_url").notNull(),
  storageKey: text("storage_key"),
  mimeType: text("mime_type").notNull().default("audio/mpeg"),
  fileSize: integer("file_size").notNull().default(0),
  plays: integer("plays").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SongRow = typeof songs.$inferSelect;
export type NewSongRow = typeof songs.$inferInsert;
