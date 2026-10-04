-- Runs only once, when Postgres starts for the first time.
-- (After changing this file, run `npm run reset`.)
--
-- One database per service. A service must not read another service's tables.

CREATE DATABASE orders;
CREATE DATABASE payments;

-- Tables come later.
