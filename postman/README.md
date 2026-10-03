# Postman collection

The endpoints of the three services, ready to import.

## Import

Postman → **Import** → drop in `glassbox.postman_collection.json`.

No environment file needed. The three base URLs are collection variables; change them
under the collection's **Variables** tab if your ports differ.

## Use

```bash
npm run up
npm run dev
```

Then run **api-gateway → Checkout**. Copy the `requestId` from the response and paste
it into Grafana (http://localhost:3000) → **Explore** → **Loki** → **Code**:

```logql
{service_name=~".+"} | req_id = `paste-it-here`
```

You get that one request's log lines and nothing else, even though other requests ran
at the same time.

Logs take a few seconds to appear — the service writes a file, the OTel Collector
reads it, Loki stores it.
