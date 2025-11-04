import type { PoolClient } from "pg";

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE selection_groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Create an index on the name column for faster lookups
    CREATE INDEX idx_selection_groups_name ON selection_groups(name);
    
    -- Create a trigger to automatically update the updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    CREATE TRIGGER update_selection_groups_updated_at
      BEFORE UPDATE ON selection_groups
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  console.log("  ✅ Created selection_groups table");
  console.log("  ✅ Created index on name column");
  console.log("  ✅ Created updated_at trigger");
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TRIGGER IF EXISTS update_selection_groups_updated_at ON selection_groups;
    DROP FUNCTION IF EXISTS update_updated_at_column();
    DROP TABLE IF EXISTS selection_groups;
  `);

  console.log("  ✅ Dropped selection_groups table and related objects");
}
