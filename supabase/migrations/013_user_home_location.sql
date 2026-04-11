-- Add home location coordinates to user_roles
alter table user_roles
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision;
