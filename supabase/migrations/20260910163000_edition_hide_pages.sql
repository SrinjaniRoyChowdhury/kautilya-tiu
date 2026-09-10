-- Add hide_executive_board and hide_team flags to mun_editions
ALTER TABLE mun_editions
  ADD COLUMN IF NOT EXISTS hide_executive_board boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_team           boolean NOT NULL DEFAULT false;
