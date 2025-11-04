import type { ColumnType } from "kysely";

// Selection data structure stored in JSONB
export interface SelectionData {
  [episodeName: string]: {
    start: number; // seconds
    end: number; // seconds
  };
}

// Database table schema
export interface SelectionGroupsTable {
  id: ColumnType<number, never, never>; // Generated, can't insert/update
  name: string;
  data: ColumnType<SelectionData, SelectionData, SelectionData>; // JSONB column
  created_at: ColumnType<Date, never, never>; // Generated
  updated_at: ColumnType<Date, never, Date>; // Can be updated
}

// Database schema
export interface Database {
  selection_groups: SelectionGroupsTable;
}

// API Response types
export interface SelectionGroup {
  id: number;
  name: string;
  data: SelectionData;
  created_at: Date;
  updated_at: Date;
}

export interface SelectionGroupListItem {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}
