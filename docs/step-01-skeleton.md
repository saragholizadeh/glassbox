# Step 01 — Skeleton and infrastructure

**Goal:** get a three-service NestJS monorepo and a full observability stack running
on your machine, and be able to prove it works. No telemetry yet — that starts in
step 2.

---

## What you should be able to do at the end

```bash
npm run setup && npm run up && npm run check
```

...and see ten green checks. Then `npm run dev` and get three services answering on
ports 3001–3003.

---

## What got built

### The monorepo

Three NestJS apps sharing one `node_modules` and one shared library:

```
services/
├── apps/api-gateway/        port 3001 — public entry point
├── apps/orders-service/     port 3002 — owns orders
├── apps/payments-service/   port 3003 — consumes from Kafka
└── libs/common/             shared health module + service identity
```

They are almost empty on purpose. Each exposes `GET /` (describing itself) and two
health endpoints. The business logic arrives in step 4 — the plumbing between them
is the lesson, not the code inside them.

### Why 3001 and not 3000

Grafana takes 3000. You will be looking at Grafana constantly.

---

## Two things worth understanding

### 1. Liveness is not readiness

Every service exposes two endpoints, and the difference matters in production:

| | Question it answers | What fails if it fails |
|---|---|---|
| `GET /health/live` | Is this process alive? | The container gets **restarted** |
| `GET /health/ready` | Should it receive traffic? | It is pulled from the **load balancer** |

The rule that follows from this: **liveness must never check a dependency.**

Imagine you check Postgres in your liveness probe and the database gets slow. Every
instance fails its probe at the same moment, every container is killed, and you have
turned a slow database into a total outage. Meanwhile the restarts do nothing,
because the problem was never in your app.

Readiness may check dependencies, because failing it is harmless and reversible — the
instance just stops receiving traffic until it recovers.

Right now `ready` only checks heap size. Step 4 adds Postgres, Redis and Kafka.

See [`services/libs/common/src/health/health.controller.ts`](../services/libs/common/src/health/health.controller.ts).

### 2. `app.enableShutdownHooks()`

It is in all three `main.ts` files and does nothing visible yet. It tells Nest to run
its shutdown lifecycle when the process gets SIGTERM.

Step 3 hangs the OpenTelemetry flush off it. Without it, any spans still sitting in
memory when the container is killed are lost — which are exactly the spans from the
requests that were failing when it died. That is the moment you most want them.

---

## Why the services are not in Docker

Everything they *talk to* is containerised, but the services themselves run on your
host via `npm run dev`. You keep hot reload, breakpoints and instant restarts.

This also means the services reach the infrastructure at `localhost`, which is why
`.env` says `KAFKA_BROKERS=localhost:29092` and not `kafka:9092`. Kafka advertises
two listeners for exactly this reason — one for containers, one for your host.

---

## The infrastructure

Nine containers. In rough order of how much you will care about them:

| Container | Why it exists |
|---|---|
| **Grafana** | Where you look at everything |
| **OTel Collector** | Single place the services send all telemetry |
| **Tempo** | Stores traces |
| **Prometheus** | Stores metrics |
| **Loki** | Stores logs |
| **Kafka** + **Kafka UI** | The async hop, and a way to see message headers |
| **Postgres** | Two databases, one per owning service |
| **Redis** | Cache |

### Why a Collector instead of exporting straight to storage

The services could send traces directly to Tempo. Three reasons they don't:

1. **Your app code never learns your monitoring vendor's name.** Swapping Tempo for
   something else later is a change in one config file, not a redeploy of three
   services.
2. **Sampling happens where the whole trace is visible.** In production you keep
   maybe 1% of traces, but 100% of the ones that errored or were slow. Only the
   Collector can make that decision, because only it sees every span in a trace. An
   individual service never does.
3. **One network hop out of the app** instead of three.

Configuration: [`infra/otel-collector/config.yaml`](../infra/otel-collector/config.yaml).

### Grafana comes pre-wired

The datasources are provisioned from
[`infra/grafana/provisioning/datasources/datasources.yml`](../infra/grafana/provisioning/datasources/datasources.yml),
including the two links that make the whole thing click:

- **Tempo → Loki** (`tracesToLogsV2`): click a slow span, see that exact request's logs
- **Loki → Tempo** (`derivedFields`): click a log line's trace id, see the trace

They do nothing until steps 2 and 3 produce data, but they are already configured.

> **A trap already survived:** those link templates contain `${__span.traceId}` and
> friends. Grafana expands `${...}` in provisioning files as *environment variables*,
> so a single `$` silently turns them into empty strings and the links break with no
> error. They are written as `$${...}` in the file. If you ever edit them, keep the
> doubled `$$`.

---

## Verifying it

`npm run check` ([`scripts/check.mjs`](../scripts/check.mjs)) pokes every port your
services will really use and prints a table. Containers reporting "running" is not
the same as "working" — Loki and Tempo both report `503` for their first ~20 seconds
while their internal rings form, which is normal.

If something stays down:

```bash
docker compose ps           # what's actually up
docker compose logs tempo   # or kafka, loki, ...
npm run reset               # nuclear option: wipe all volumes and start over
```

---

## Things you can poke at right now

```bash
# The services describe themselves
curl localhost:3001/ | jq
curl localhost:3002/ | jq

# Health endpoints
curl localhost:3001/health/live | jq
curl localhost:3001/health/ready | jq

# The request the whole project is about (a stub until step 4)
curl -X POST localhost:3001/checkout | jq

# Both databases exist
docker exec glassbox-postgres psql -U glassbox -l

# Kafka is reachable and has no topics yet
docker exec glassbox-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```

---

## Next

**Step 02 — structured logging with trace ids.** Pino in one service, Winston in
another, both behind the same interface, both shipping to Loki. Then we benchmark
them against each other, because in a project about performance it is worth knowing
that Winston is roughly five times slower.
