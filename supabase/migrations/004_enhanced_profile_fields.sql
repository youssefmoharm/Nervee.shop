-- Enhanced Profile Fields Migration
-- Adds additional columns to customers table for enhanced profile features

-- Add new profile columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer-not-to-say')),
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT CHECK (LENGTH(bio) <= 500);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_gender ON customers(gender);

-- Add comments for documentation
COMMENT ON COLUMN customers.date_of_birth IS 'User birth date for age-based features';
COMMENT ON COLUMN customers.gender IS 'User gender for personalization';
COMMENT ON COLUMN customers.city IS 'User city for location-based features';
COMMENT ON COLUMN customers.bio IS 'User bio/about me text (max 500 chars)';

-- Update RLS policies to allow users to update their enhanced profile
-- The existing policies should already cover this, but let's be explicit
-- Users can update their own profile including new fields
DROP POLICY IF EXISTS "Users can update own enhanced profile" ON customers;
CREATE POLICY "Users can update own enhanced profile" ON customers
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);