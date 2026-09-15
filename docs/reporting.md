# Detection Reporting & Event Streaming

Every face detection tick from a live camera is published to the Kafka topic
`detections`, consumed by the `worker` service, and folded into presence
intervals in the `detection_events` Postgres table (see
`backend/app/worker/events_consumer.py` for the debounce/session-grouping
logic). The `/api/reporting/*` endpoints (admin-only) and the `/reporting`
frontend page read from that table.

## Retention

No automatic cleanup is implemented yet. `detection_events` grows with every
new presence interval, which — even after debouncing — will accumulate
steadily under continuous camera operation. Recommended for when this goes
beyond R&D:

- A scheduled job (cron, or `pg_cron` inside Postgres) running monthly:
  ```sql
  DELETE FROM detection_events WHERE ended_at < now() - interval '180 days';
  ```
- If volume grows large enough that a single `DELETE` becomes expensive,
  consider partitioning `detection_events` by month (e.g. via `pg_partman`)
  so old partitions can simply be dropped instead of row-deleted.

Adjust the retention window (180 days above) to whatever policy applies to
personal-tracking data in your deployment.

## Deferred / future scope

These were explicitly scoped out of the initial implementation, but the
Kafka `detections` topic is designed so each is just another independent
consumer group reading the same stream — none of them require changes to
the producer or to the existing events-persistence consumer:

- **Multi-camera "path" reconstruction** — chaining a person's detections
  across cameras into a route for a given day.
- **Live "who's on-site now" dashboard** — a consumer that maintains
  current-presence state in memory/Redis instead of writing history to
  Postgres.
- **Alerting** — e.g. notify on an unrecognized face or a watch-listed
  person, as a consumer that reacts to messages in real time rather than
  persisting them.
