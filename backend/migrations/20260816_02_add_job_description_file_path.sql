-- Persist the source file location (local path or r2:// URI) for uploaded JDs.
ALTER TABLE job_descriptions
    ADD COLUMN IF NOT EXISTS file_path VARCHAR(500);
