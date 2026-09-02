-- Migration: Add avatar_url column to users table
-- Date: 2026-08-16

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT NULL;
