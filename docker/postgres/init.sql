-- Runs once on first container start. DEV ONLY passwords; use secrets in production.
CREATE ROLE pms_app LOGIN PASSWORD 'pms_app_dev' NOSUPERUSER NOBYPASSRLS;
GRANT CONNECT ON DATABASE hotel_pms TO pms_app;
GRANT USAGE ON SCHEMA public TO pms_app;
