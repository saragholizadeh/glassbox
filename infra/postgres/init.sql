-- Runs once, the first time the Postgres volume is created.
-- (If you change this file later, run `npm run infra:reset` to see the effect.)
--
-- Two separate databases on purpose: each service owns its own data and
-- neither can read the other's tables. That is what makes them real services
-- rather than one app split across three processes.

CREATE DATABASE orders;
CREATE DATABASE payments;

-- Tables come in step 4, together with the N+1 query bug (case study 02).
