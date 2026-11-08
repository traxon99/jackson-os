-- Lock down Supabase Data API (PostgREST): enable RLS with no policies so anon/
-- authenticated cannot read rows; revoke table privileges from those roles and PUBLIC.
-- The jackson-os server connects as the Postgres owner (service role) and is unaffected.
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'recovery_codes',
    'sessions',
    'webauthn_credentials',
    'meta',
    'action_log',
    'metric_points',
    'source_snapshots',
    'suggestions',
    'widget_layout'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', tbl);
    BEGIN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', tbl);
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END;
    BEGIN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', tbl);
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;
