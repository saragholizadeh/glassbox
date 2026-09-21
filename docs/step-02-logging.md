# Step 02 — Structured logging

**Goal:** turn logs from text a human squints at into data you can query, and give
every line an id that ties it to one specific request.

---

## Why JSON

Nest's default output reads nicely and searches terribly:

```
[Nest] 51571 - 09/19/2026, 11:41:13 PM  LOG [Bootstrap] api-gateway listening
```

You cannot ask it *"show me every error from orders-service in the last hour where
the response was 500 and it took over a second."* The information is there, as prose.

Structured logging writes fields instead:

```json
{"level":"info","time":"2026-09-21T20:59:47.799Z","service":"api-gateway",
 "req_id":"5515ecdc-b435-4cbc-b7ff-458142bfa3ab","context":"AppController",
 "orderId":5,"msg":"checkout started"}
```

You still get colourful readable output in your terminal. The JSON is what gets
stored and queried.

---

## The request id, and how it gets there

Every line carries a `req_id`. Nothing in the application passes it around.

### The problem it solves

A request arrives, and something eight function calls deep logs a line. You want to
know which request it belonged to. The obvious approach poisons every signature in
your codebase:

```ts
async createOrder(dto: Dto, reqId: string) {
  await this.repo.save(order, reqId);
  await this.mailer.send(email, reqId);
}
```

### AsyncLocalStorage

Node has a built-in feature for exactly this: stash a value when the request starts,
read it anywhere later in that request.

It is **not** a global. Node runs many requests concurrently on one thread, and a
global would have them overwriting each other. AsyncLocalStorage keeps a separate
value per async execution chain, tracked through `await`s, timers and database calls.

> The mental model: a variable that is global, but only inside one request.

We use [`nestjs-cls`](https://github.com/Papooch/nestjs-cls) as a thin wrapper. CLS
— *Continuation-Local Storage* — is an older name for the same idea.

### Why not request-scoped providers

NestJS offers `@Injectable({ scope: Scope.REQUEST })`, which looks like the answer.
Avoid it.

A request-scoped provider is rebuilt for every request — **and so is everything that
injects it**, and everything injecting that, all the way up the tree. One decorator
deep in your code can quietly make half your application reconstruct itself per
request. Throughput drops hard and nothing in your code looks wrong.

This is planted bug #3 in step 7, where we measure it.

### Proof that it works

Three concurrent requests, from `logs/api-gateway.log`:

```
20:42:40.407  7f647b06  orderId 2   AppController     checkout started
20:42:40.407  7f647b06  orderId 2   CheckoutService   reserving stock
20:42:40.408  dbbac98a  orderId 1   AppController     checkout started
20:42:40.408  dbbac98a  orderId 1   CheckoutService   reserving stock
20:42:40.419  77b05eed                                GET / 200
20:42:40.423  7f647b06  orderId 2   CheckoutService   stock reserved
20:42:40.424  7f647b06                                POST /checkout 201
20:42:40.424  dbbac98a  orderId 1   CheckoutService   stock reserved
20:42:40.424  dbbac98a                                POST /checkout 201
```

Interleaved, as Node always is — and every line kept its own id. `CheckoutService`
has no request id in its method signatures; the id survived the `await` regardless.

### The ceiling

This id is generated per service. When the gateway calls `orders-service` in step 4,
it will **not** arrive automatically — the gateway must forward an `x-request-id`
header and orders must read it, by hand, at every call site. Through Kafka it breaks
entirely.

Step 3 replaces it with an OpenTelemetry trace id, which crosses those boundaries on
its own.

---

## Two things that are easy to forget

### Health checks are excluded

A probe every 5 seconds is ~17,000 log lines per service per day, saying nothing.
Both loggers skip any path starting with `/health`.

### Secrets are redacted

`authorization`, `cookie`, `password`, `cardNumber`, `cvv` and friends are replaced
with `[Redacted]` **before** anything is written, so the value never exists in the
output. Logs get shipped off your machine, kept for months, and read by people who
were never meant to see a customer's card number.

Verified by sending real-looking secrets and grepping the log files for them: zero
hits, for both loggers.

See [`redaction.ts`](../services/libs/common/src/logging/redaction.ts). Note it holds
the same rule twice — Pino has a built-in path syntax, Winston has no redaction
feature at all, so we walk the object by hand.

---

## Pino vs Winston

`orders-service` uses Winston. The other two use Pino. Both produce **identical
JSON** — same field names, same level format, same ISO timestamps — so one Loki
query works across every service.

### The libraries differ in philosophy

**Pino** has one idea: write JSON to a stream as fast as possible. Everything else is
someone else's job.

**Winston** is built on *transports* (destinations) and *formats* (a pipeline each
record passes through). More flexible, and slower — every line becomes an object
travelling through a chain of function calls before anything is written.

**Winston also gives you less.** `nestjs-pino` ships HTTP request logging and
redaction. Winston has neither, so this repo writes them by hand — see
[`http-logger.middleware.ts`](../services/libs/common/src/logging/http-logger.middleware.ts),
which is precisely what `pino-http` was doing for you invisibly.

### Measured

```
npm run bench:loggers
```

200,000 JSON lines to a file, after 20,000 untimed warmup lines. Node 24, Linux:

| logger | total | lines/sec | µs/line | relative |
|---|---|---|---|---|
| **pino** | 868 ms | 230,427 | 4.34 | 1.00× |
| winston | 1966 ms | 101,741 | 9.83 | **2.27×** |

Three runs agreed within 1%.

So Pino is roughly **2.2× faster** — a real difference, and smaller than the 4–5×
this project initially guessed. Both write over 100,000 lines a second, which is far
more than most services need. Pick Winston for its ecosystem if you want it; just
know the number rather than the folklore.

> **A bug worth repeating.** The first version of this benchmark reported Winston as
> 9.7× *faster* than Pino. The timer stopped before Winston's asynchronous file
> transport had flushed, so it measured how fast Winston accepts calls versus how
> fast Pino writes bytes. Both are now timed door-to-door. If a benchmark tells you
> something that contradicts everything known about the subject, suspect the
> benchmark first.

---

## How logs reach Loki

The services do not talk to Loki. They write JSON files; the OTel Collector tails
them.

```
service → logs/<service>.log → OTel Collector (filelog) → Loki → Grafana
```

This is how logs really travel in production: the app writes, something else ships.
The app never blocks on the network, and if Loki is down nothing is lost — the files
are still on disk.

The receiver config is in
[`infra/otel-collector/config.yaml`](../infra/otel-collector/config.yaml). Two of its
operators matter:

```yaml
- type: move
  from: attributes.service
  to: resource["service.name"]
```

Loki turns **resource** attributes into indexed labels, and leaves ordinary
attributes as structured metadata. Without this promotion,
`{service_name="orders-service"}` matches nothing.

### Labels vs structured metadata

This distinction is the one to internalise, because getting it wrong is how people
take down their own monitoring.

Loki indexes **labels**. Every distinct combination of label values creates a
separate stream. Put something high-cardinality in a label — a user id, a request id
— and you create millions of streams and Loki falls over. That is planted bug #5.

Everything else becomes **structured metadata**: still queryable, not indexed, cheap.

Confirmed on this setup:

```
$ curl -s localhost:3100/loki/api/v1/labels
  deployment_environment
  service_name

$ curl -s localhost:3100/loki/api/v1/label/req_id/values
  0 values   ← req_id is NOT indexed. Correct.
```

Two labels total. `req_id`, `responseTime`, `orderId` and the rest ride along as
metadata.

> The query API echoes structured metadata back inside the `stream` object, which
> makes it look like everything is a label. `/loki/api/v1/labels` is the honest list.

---

## Try it

```bash
npm run up
npm run dev

curl -X POST localhost:3001/checkout -H 'content-type: application/json' -d '{"orderId":5}'
curl -X POST localhost:3002/orders
```

Then in Grafana (http://localhost:3000) → **Explore** → **Loki**:

```logql
{service_name="api-gateway"}                          # everything from one service
{service_name=~".+"} | req_id = "<paste an id>"       # one request's whole story
{service_name=~".+"} | level = "error"                # errors everywhere
{service_name="orders-service"} | responseTime > 100   # slow requests
```

Watch the log files directly:

```bash
tail -f logs/api-gateway.log | jq
```

---

## A NestJS detail worth knowing

Both `main.ts` files create the app with `bufferLogs: true`, then call
`app.useLogger(...)`.

Without the buffer, everything Nest logs during startup uses its default logger and
comes out unstructured, because your logger does not exist yet. `bufferLogs` holds
those lines back until the real logger is ready.

---

## Next

**Step 03 — OpenTelemetry.** Your first real trace, and the `trace_id` that replaces
`req_id` — one that crosses service boundaries without being forwarded by hand.
