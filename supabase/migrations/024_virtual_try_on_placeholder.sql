-- Migration 024: Virtual Try-On was introduced then removed (feature dropped).
-- This is an intentional no-op so migration numbering stays continuous with
-- migration 025's reference ("Safe to run whether or not 024 was previously
-- applied"). Do NOT add virtual_try_on DDL here — 025 drops it if present.
SELECT 1;
