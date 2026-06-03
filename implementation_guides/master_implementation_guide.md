# Infrastructure Simulator — Master Implementation Guide

**Last Updated:** June 2026  
**Current Version:** 0.1.0 (single-file prototype)  
**Purpose:** Exhaustive feature backlog and implementation specification for turning this prototype into a serious educational system design game.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Simulation Fidelity — Critical Gaps](#2-simulation-fidelity--critical-gaps)
3. [Metrics & Observability Panel](#3-metrics--observability-panel)
4. [Component Library Expansion](#4-component-library-expansion)
5. [Component Configuration System](#5-component-configuration-system)
6. [Failure & Chaos Engineering Mode](#6-failure--chaos-engineering-mode)
7. [Level & Curriculum Design](#7-level--curriculum-design)
8. [Canvas & UX Improvements](#8-canvas--ux-improvements)
9. [Traffic & Load Modeling](#9-traffic--load-modeling)
10. [Connection System Overhaul](#10-connection-system-overhaul)
11. [Save, Load & Share](#11-save-load--share)
12. [Architecture Refactor](#12-architecture-refactor)
13. [Scoring & Progression System](#13-scoring--progression-system)
14. [Implementation Priority Matrix](#14-implementation-priority-matrix)
15. [Technical Specifications](#15-technical-specifications)

---

## 1. Current State Assessment

### What Exists (v0.1.0)

The prototype is a 1,264-line single HTML/CSS/JS file. It works as a proof of concept and correctly demonstrates the basic idea: drag components, wire them together, press simulate, watch packets flow. The visual design is solid — dark theme, clear iconography, component cards with color-coded categories, bezier-curve connections, glowing packet animation.

**Inventory of what actually works today:**

| Feature | Status | Quality |
|---|---|---|
| 11 component types (4 categories) | ✅ Working | Good |
| Drag from palette to canvas | ✅ Working | Good |
| Move components by drag | ✅ Working | Good |
| Connect mode (click-to-connect) | ✅ Working | Good |
| Delete mode / keyboard delete | ✅ Working | Good |
| Animated packet simulation | ✅ Working | Good |
| Load balancer round-robin | ✅ Working | Accurate |
| Cache hit/miss (80%) | ✅ Working | Approximate |
| CDN hit/miss (85%) | ✅ Working | Approximate |
| Message queue async delay | ✅ Working | Approximate |
| Inspector panel | ✅ Working | Minimal |
| Level 1 goal system (BFS validation) | ✅ Working | Functional |
| Keyboard shortcuts | ✅ Working | Complete |
| Win overlay | ✅ Working | Good |
| Hint bar | ✅ Working | Good |

### Critical Gaps (Why This Is Still a Prototype)

The current simulation is a **visual metaphor**, not an educational model. Packets flowing along lines looks impressive but teaches almost nothing about *why* infrastructure is designed the way it is. A student could complete Level 1 without understanding what a load balancer actually does or why you need one.

The game is missing:

1. **No metrics.** The most important output of any infrastructure is its performance characteristics — latency, throughput, error rate. The current sim shows packets but not what they represent in measurable terms. A student cannot tell the difference between a good and a bad architecture because there's nothing to measure.

2. **No failure states.** In reality, everything fails. Components go down, networks partition, disks fill up. A game about infrastructure that never shows failure teaches nothing about resilience, redundancy, or why you have a load balancer in front of two servers instead of one.

3. **No overload states.** Components have infinite capacity in the current model. A single database server can handle 1 packet/second or 1 million — there is no difference. This is the opposite of reality and teaches the wrong mental model.

4. **No real traffic model.** The client spawns exactly one packet every ~1.3 seconds. Real traffic is bursty, follows diurnal patterns, and spikes unexpectedly. The absence of traffic modeling means students never see *why* you need horizontal scaling.

5. **Only one level.** There is no curriculum. A student completes Level 1 and has nowhere to go.

6. **No configuration.** Components are all identical instances of their type. You cannot set the cache hit rate, the number of database connections, the server's request capacity, or any other parameter that makes a component behave differently. This is a massive educational gap.

7. **No canvas pan/zoom.** You cannot build architectures larger than the visible screen. Real system designs have 20–50 components.

8. **No undo/redo.** This is a basic usability requirement for any creative tool.

9. **No save/load.** Refreshing the page destroys all work.

10. **Connections cannot be individually deleted.** The user must delete the whole component to remove a connection.

---

## 2. Simulation Fidelity — Critical Gaps

These are the places where the simulation currently teaches *incorrect* or *incomplete* mental models. Fixing these is the highest educational priority.

### 2.1 Latency Modeling

**Current behavior:** All packets travel at roughly the same speed regardless of what they're traversing. A packet crossing a CDN and a packet hitting a cold relational database look identical.

**Why this is wrong:** Latency is the most intuitive performance metric and the primary reason infrastructure decisions are made. L1 cache: 0.5ns. Redis: 100µs. Postgres query: 1–10ms. Cross-datacenter round trip: 100ms. These numbers matter enormously and are completely invisible in the current sim.

**What to build:**
- Each component type has a `baseLatencyMs` property (e.g., Cache: 0.5ms, SQL DB: 5ms, NoSQL DB: 2ms, Web Server: 10ms, Message Queue delivery: 500ms).
- Packet travel speed on a connection is proportional to the latency of the *destination* component. Fast components (cache) = fast-moving packets. Slow components (DB on disk) = slow packets.
- Connection length also adds latency (network RTT). Long connections = slower packets, modeling geographic distance.
- A live latency counter per packet (show ms elapsed) displayed as the packet arrives.
- A "request latency" metric displayed in the metrics panel (Section 3) shows p50, p95, p99 across all completed request paths from Client to Sink.

**Realistic latency values:**
| Component | Base Latency | Notes |
|---|---|---|
| CDN (hit) | 2ms | Edge node, geographically close |
| Cache (hit) | 0.5ms | In-memory, same machine |
| Cache (miss) | 1ms + DB latency | Network hop to DB |
| Web Server | 5–20ms | App logic processing |
| App Server | 10–50ms | Business logic, heavier |
| API Gateway | 1–5ms | Routing + auth overhead |
| Load Balancer | <1ms | L7 parsing + routing |
| SQL DB (read) | 1–10ms | Index lookup, cached pages |
| SQL DB (write) | 5–20ms | WAL write, fsync |
| NoSQL DB (read) | 1–5ms | Key lookup |
| NoSQL DB (write) | 1–3ms | Async replication |
| Message Queue (enqueue) | 1–5ms | Broker write |
| Message Queue (deliver) | 100–2000ms | Consumer poll interval |
| Worker (process) | 100ms–10s | Task-dependent |

### 2.2 Throughput & Capacity Modeling

**Current behavior:** Components have infinite capacity. No concept of saturation or overload.

**Why this is wrong:** The entire reason you add servers, add replicas, and build queues is because components have capacity limits. Teaching infrastructure without capacity is teaching cars without speed limits.

**What to build:**
- Each component has a `maxRPS` (max requests/second) property, configurable in the inspector.
- Each component tracks its current `currentRPS` based on packets arriving per second.
- When `currentRPS > maxRPS * 0.7`: component enters **stressed** state (visual: amber tint, warning icon).
- When `currentRPS > maxRPS`: component enters **overloaded** state (visual: red tint, alarm icon, starts dropping/failing packets at a configurable error rate).
- Default `maxRPS` values (configurable):
  - Client: Infinite (it's the traffic source)
  - Load Balancer: 100,000 rps (rarely the bottleneck)
  - Web Server: 1,000 rps
  - App Server: 500 rps
  - Cache: 100,000 rps
  - SQL DB: 5,000 rps
  - NoSQL DB: 50,000 rps
  - Message Queue: 1,000,000 rps (Kafka-class)
  - Worker: 100 rps (slow background processing)
- The load meter is visualized as a thin bar across the bottom of each component card, color-coded green/amber/red.

**Educational payoff:** When a student routes too much traffic to a single SQL DB, it turns red and starts dropping packets. They viscerally understand why you need read replicas or caching. This is the single most important educational feature missing from the current version.

### 2.3 Packet Types: Reads vs. Writes

**Current behavior:** All packets are identical (blue dot). There is no distinction between read and write operations.

**Why this is wrong:** The read/write distinction is fundamental. Reads can be served from cache or replicas. Writes must go to the primary database. Cache-aside only helps reads. This distinction drives almost all real architectural decisions.

**What to build:**
- Two packet types: **READ** (blue dot) and **WRITE** (orange dot).
- Client generates a configurable mix (default: 80% reads, 20% writes — the standard "read-heavy" pattern).
- Components route reads and writes differently:
  - Cache: intercepts reads (hit/miss logic). Writes pass straight through and invalidate cache entries.
  - SQL DB Primary: accepts both reads and writes.
  - SQL Read Replica: accepts reads only. Write packets bounce back with an error packet.
  - Load Balancer: routes both, but can be configured to send writes to specific servers.
- Error packets are a third type: red dot, traveling back toward the client, representing failed requests.
- Students learn: "I need to separate my read and write paths" — one of the most common real-world architectural decisions.

### 2.4 Response Path (Round-Trip Modeling)

**Current behavior:** Packets travel one way, Client → Sink. There are no responses.

**Why this is wrong:** HTTP is a request-response protocol. The client doesn't just fire and forget — it waits for a response. The response time (latency) is what users actually feel. An architecture that's fast on requests but has a slow response path is still a slow architecture.

**What to build:**
- When a packet reaches a Sink, a **response packet** is generated.
- The response packet travels back along the same path (in reverse) to the Client.
- The Client displays a latency number for each completed round-trip: `Client → LB → Server → DB → Server → LB → Client = 47ms`.
- The round-trip time is computed from the sum of component latencies along the path.
- The response packet is a smaller, slightly different visual (hollow circle, same color).
- This enables the metrics panel (Section 3) to show real latency distributions.

### 2.5 Queue Backpressure & Depth

**Current behavior:** The message queue delays packets and fans them out. There is no concept of queue depth or backpressure.

**Why this is wrong:** Queue depth is a critical operational metric. An unbounded queue that fills faster than it drains causes **memory exhaustion** — the queue process crashes, losing all in-flight messages. This is one of the most common production incidents in event-driven systems.

**What to build:**
- Each message queue has a `maxDepth` property (default: 10,000 messages).
- A live **queue depth gauge** displayed on the queue component card (e.g., a fill level: ▓▓▓░░░ 3,241 / 10,000).
- When depth > 80% of max: queue enters stressed state (amber).
- When depth = max: queue is **full**. New packets are **dropped** (or rejected, depending on config). This triggers an error packet.
- Queue drain rate = number of downstream workers × worker `maxRPS`.
- If producers enqueue faster than consumers drain, depth grows. Students must add more workers or slow production.
- **Educational payoff:** Students discover that adding a queue without enough workers just delays the crash instead of preventing it.

### 2.6 Connection Direction Enforcement

**Current behavior:** Any component can connect to any other component in any direction. You can connect a database output to a load balancer input, which makes no sense.

**What to build:**
- Connection validation rules. When a student tries to create an invalid connection, a red error flash appears on the connection with a tooltip explaining why.
- Validation rules (incomplete list):
  - SQL DB / NoSQL DB (isSink): cannot have outgoing connections (except to a Read Replica pair)
  - Client (isSource): cannot have incoming connections
  - Worker must be downstream of a Message Queue
  - Cache must be between App/Web Server and Database (not upstream of LB)
- Invalid connections are still *allowed* (students learn from mistakes) but are shown in red with an explanatory tooltip.
- During simulation, invalid connections carry 0 traffic (packets generated at invalid end are dropped).

### 2.7 Database Replication

**Current behavior:** SQL DB and NoSQL DB are single-node sinks. No concept of primary/replica.

**What to build:**
- A **"Promote to Cluster"** button in the inspector for databases that enables a primary/replica configuration.
- When enabled, the component expands visually to show: Primary (accepts R+W) + Replica (accepts R only) + Replication Lag indicator.
- Replication lag: a small counter (default ~10ms for SQL, ~50ms for NoSQL) shown between primary and replica.
- Write packets go to primary only. Read packets can go to replica.
- When the primary is overloaded and stress-state, replication lag increases (visual: lag counter climbs to 500ms, 2000ms, etc.).
- If primary fails (chaos mode), students see that the replica has data from before the lag cutoff — illustrating **replication lag as data loss window**.

---

## 3. Metrics & Observability Panel

This is the most important new UI feature. Without metrics, students cannot tell whether their architecture is working well or poorly.

### 3.1 Live Metrics Panel

**What to build:** A collapsible panel that appears at the bottom of the canvas during simulation. Shows a live dashboard with the following metrics, updating every second:

**System-Wide Metrics:**
- **Throughput (RPS):** Total requests/second being processed end-to-end (successfully reaching a sink).
- **Error Rate (%):** Percentage of requests that failed (dropped packets, overloaded components, invalid paths).
- **p50 Latency:** Median round-trip time in milliseconds.
- **p95 Latency:** 95th percentile round-trip time (what 95% of users experience or better).
- **p99 Latency:** 99th percentile (the "tail latency" — often 5–10× the median; critical for SLA engineering).
- **Active Requests:** Packets currently in flight in the system.

**Per-Component Metrics (shown on hover or in inspector):**
- Current RPS received
- Current RPS processed
- Error rate for this component
- For Cache: live hit rate % (updates as simulation runs)
- For Queue: current depth + drain rate
- For LB: distribution across backends (is it actually balanced?)
- For DB: read/write ratio

**Why p95/p99 matter (explain in a tooltip):** The median latency hides the experience of the slowest 5% or 1% of users. A system with p50=20ms but p99=2000ms is problematic even though "most" requests are fast. Services like AWS, Stripe, and Google track p99 as a first-class SLA metric.

### 3.2 Latency Distribution Chart

A small real-time histogram (30-second window) showing latency distribution. As traffic flows through the architecture, the histogram fills in and students can see: is this a tight bell curve (predictable) or a long tail (some requests taking much longer)?

- Built using HTML Canvas (2D), not SVG — canvas is far better for real-time charts.
- X-axis: latency (0ms to 2000ms, log scale).
- Y-axis: count of requests in each bucket.
- Color-coded: green (<100ms), amber (100–500ms), red (>500ms).
- Resets when simulation is stopped.

### 3.3 Throughput Over Time Chart

A simple line chart (60-second window) showing throughput (RPS) over time. Students can observe:
- Initial ramp-up as packets spawn.
- Traffic spikes when they trigger a load event (Section 9).
- Throughput drop when a component fails (Section 6).
- Recovery after adding a server.

---

## 4. Component Library Expansion

The current 11 components cover the basics but miss critical real-world components that students will encounter in every production system they work with.

### 4.1 Missing Components — Tier 1 (Essential)

These are standard components that appear in virtually every production architecture diagram.

**DNS Server**
- Category: Traffic
- Behavior: Routes client requests to CDN or load balancer based on DNS records. Supports A records (single IP), CNAME (alias), and weighted routing (split traffic between two LBs for canary deployments).
- Educational purpose: Students learn that DNS is the first hop and that DNS-level routing enables geographic distribution and canary releases.
- Config: TTL (30s, 300s, 3600s) — shorter TTL = faster failover but more DNS queries.

**Web Application Firewall (WAF)**
- Category: Traffic
- Behavior: Sits between internet and your system. Drops malicious packets (SQL injection, XSS, bot traffic). In simulation: drops a configurable % of packets as "bad traffic." Has a rate at which it identifies and drops vs. passes threats.
- Educational purpose: Security layer. Students learn that raw internet traffic contains significant noise and attack traffic.

**Rate Limiter**
- Category: Traffic  
- Behavior: Enforces a requests-per-second ceiling. Packets arriving above the limit are queued (if queue buffer configured) or dropped with an error response. Implements token bucket algorithm internally.
- Educational purpose: Rate limiters protect downstream services. Students see that without one, a traffic spike can cascade into DB overload.
- Config: `rpsLimit` (default: 1000 rps), `burstSize` (default: 200 — allows short bursts above limit), `algorithm` (token bucket vs. fixed window vs. sliding window — each has different behavior).

**Service Registry / Service Discovery**
- Category: Compute
- Behavior: A central directory that services register with on startup and query to find each other. In simulation: tracks which service instances are healthy and routes traffic only to registered healthy instances.
- Educational purpose: In dynamic environments (Kubernetes, EC2 auto-scaling), service IPs change constantly. Hard-coded addresses break. Service discovery (Consul, Eureka, AWS Service Discovery) is how microservices find each other.

**Circuit Breaker**
- Category: Compute
- Behavior: Wraps a connection to a downstream dependency. States: CLOSED (passing traffic normally), OPEN (blocking all traffic, returning errors immediately), HALF-OPEN (letting a test packet through to check if downstream recovered).
- Transitions: CLOSED → OPEN when error rate exceeds threshold (e.g., 50% errors in 10 seconds). OPEN → HALF-OPEN after timeout (e.g., 30 seconds). HALF-OPEN → CLOSED if test packet succeeds; → OPEN if it fails.
- Educational purpose: Circuit breakers prevent cascading failures. Without one, a slow DB causes all servers to accumulate slow requests, consuming threads until they too crash.

**Read Replica**
- Category: Data
- Behavior: Connects to a primary SQL DB. Receives a copy of all writes (with replication lag). Serves read requests only. Cannot accept writes — those are forwarded to primary.
- Educational purpose: The most fundamental SQL scaling technique. Students learn that reads and writes can be separated, that replicas trade consistency (replication lag) for scale.
- Config: `replicationLagMs` (default: 10ms, increases under primary load).

**Object Storage (S3/GCS/Blob)**
- Category: Data
- Behavior: Serves large binary objects (images, videos, files). Extremely high durability (11 nines). Acts as a sink for write packets; read packets return large-payload responses. Integrates naturally with CDN.
- Educational purpose: Students often conflate databases with object storage. Storing images in Postgres is a classic anti-pattern. Object storage is specifically designed for blobs.

**Elasticsearch / Search Index**
- Category: Data
- Behavior: Full-text search index. Accepts write packets (indexing new documents) asynchronously from a primary database or message queue. Serves read packets (search queries) with very fast response. Does not replace the primary DB — it's a derived read model.
- Educational purpose: CQRS pattern. Students learn that different read models can be built on top of the same write model.

### 4.2 Missing Components — Tier 2 (Advanced Architecture)

**Primary–Replica Pair (as a single component)**
- A grouped component representing a database cluster with automatic failover. Internally shows: PRIMARY node, REPLICA node, replication connection. During chaos mode, primary can fail and replica promotes (with a configurable promotion delay of 10–60 seconds).
- Educational purpose: High availability for stateful systems. Students see that "just add a replica" doesn't give you instant failover — there's always a gap.

**Shard Group**
- A grouped component representing a horizontally sharded database. Config: `numShards` (2–16). Internally shows a shard router that distributes writes by key hash. Students can observe which shards are hot (receiving more traffic) based on key distribution.
- Educational purpose: Database sharding is the most complex and consequential scaling decision in backend engineering. Students learn that sharding is irreversible, that cross-shard queries are expensive, and that key choice determines load distribution.

**Kubernetes Pod / Auto-Scaler**
- A meta-component that wraps 1–N instances of another component (e.g., Web Server) and automatically scales the count up or down based on CPU utilization or RPS.
- Config: `minReplicas`, `maxReplicas`, `targetRPS` (scale up when current RPS > targetRPS * replicas).
- Educational purpose: The transition from manually managed servers to auto-scaling is one of the most important concepts in modern infrastructure.

**Kafka Topic (distinct from generic queue)**
- Distinct from the generic message queue. Kafka topics are partitioned. Each partition is ordered. Multiple consumer groups can read the same topic independently. Retention is configurable (don't delete after delivery).
- Config: `numPartitions` (1–32), `retentionHours`, number of consumer groups.
- Educational purpose: The difference between traditional queues (delete after ack) and Kafka-style logs (retain, replay) is fundamental to modern data engineering.

**Data Warehouse (Snowflake/BigQuery/Redshift)**
- Category: Data / Analytics
- Behavior: Receives event streams via a message queue or ETL process. Does not serve real-time requests — has high ingestion latency (seconds to minutes) but can process analytical queries across billions of rows.
- Connection: typically downstream of a message queue or change-data-capture (CDC) stream from a primary DB.
- Educational purpose: Students learn the distinction between OLTP (operational) and OLAP (analytical) workloads.

**Monitoring / Alerting (Prometheus + Grafana)**
- Category: Observability
- Behavior: Scrapes metrics from all connected components. Does not sit in the request path. Triggers alert packets (red warning icons) when thresholds are breached.
- Educational purpose: Observability is not optional in production. Students learn that monitoring is itself a component that must be designed and connected.

**Auth Service / Identity Provider**
- Category: Compute
- Behavior: Validates tokens on incoming requests. Fast path for cached tokens (low latency). Slow path for fresh validation against user database.
- Educational purpose: Authentication/authorization is a cross-cutting concern that must be placed correctly in the request path. Placing it after the business logic server is wrong — requests should be rejected at the perimeter.

### 4.3 Missing Components — Tier 3 (Specialist / Later Levels)

- **Stream Processor** (Apache Flink, Spark Streaming) — stateful real-time computation on event streams
- **Feature Store** — serving layer for ML features
- **Vector Database** (Pinecone, Weaviate) — similarity search for ML/AI use cases
- **Time-Series Database** (InfluxDB, TimescaleDB) — optimized for metrics and IoT data
- **Graph Database** (Neo4j) — relationship traversal at scale
- **In-Memory Database** (Redis used as primary, not cache) — durability tradeoffs
- **Secrets Manager** (Vault) — secure credential distribution
- **Config Server** (Consul, etcd) — distributed configuration

---

## 5. Component Configuration System

**Current behavior:** Every component of the same type is identical. You cannot configure a cache to have a 95% hit rate vs. 50%, or a database to have a 100 rps limit vs. 10,000 rps.

**Why this is critical:** Configuration is what makes components behave differently from each other. A correctly configured cache vs. a poorly configured cache produce completely different system behavior. Without configuration, students learn nothing about tuning.

### 5.1 Inspector Panel Overhaul

The right-side inspector must become a real configuration panel, not just a display.

**For each component, the inspector shows:**

1. **Component name** (editable — click to rename: "Primary DB", "US-East CDN", "Payments Cache")
2. **Type badge** with tooltip
3. **Configuration fields** (type-specific, described below)
4. **Live metrics** for this component (during simulation)
5. **Connection list** (list each named input/output with the component it connects to + delete button per connection)
6. **Documentation link** that opens the relevant section of `engineering_concepts.md`

**Per-type configuration fields:**

**Client:**
- `rps` (number): Requests per second to generate (default: 10). Range: 1–100,000.
- `readWriteRatio` (slider): % reads vs. writes (default: 80/20).
- `trafficPattern` (select): Steady | Diurnal (peaks at "daytime") | Spike (random large bursts).

**Load Balancer:**
- `algorithm` (select): Round Robin | Least Connections | Weighted Round Robin | IP Hash.
- `healthCheckInterval` (number): ms between health checks on backends (default: 5000ms).
- `stickySession` (toggle): Whether to pin clients to servers (breaks horizontal scalability).

**Cache:**
- `maxMemoryMB` (number): Cache memory limit (default: 256MB).
- `evictionPolicy` (select): LRU | LFU | TTL-based.
- `ttlSeconds` (number): Time-to-live for cached entries (default: 300s).
- `hitRate` (display, not editable directly): Computed from access pattern — starts as a rough estimate, converges to actual during simulation.

**SQL Database:**
- `maxConnections` (number): Connection pool size (default: 100). When exceeded, requests queue or error.
- `indexedColumns` (list): Toggle which fields are indexed. Affects read latency.
- `replicaCount` (number): Number of read replicas (0–5).
- `diskType` (select): HDD | SSD | NVMe — affects write latency (20ms / 5ms / 0.5ms).

**Message Queue:**
- `maxDepth` (number): Maximum queue depth (default: 10,000).
- `deliveryGuarantee` (select): At-Most-Once | At-Least-Once | Exactly-Once.
- `numPartitions` (number, Kafka mode): 1–128.
- `retentionHours` (number): How long messages are retained (default: 24h).
- `messageOrdering` (select): Per-partition FIFO | Global FIFO | Best-effort.

**Web/App Server:**
- `maxConcurrentRequests` (number): Max in-flight requests before queuing (default: 1000).
- `timeoutMs` (number): Max time to wait for downstream response before returning error (default: 5000ms).
- `instanceCount` (number): How many replicas (visual: shows a stack of cards).

**CDN:**
- `hitRate` (slider): 0%–99% (default: 85%). Configurable to model poorly or well-cached systems.
- `edgeLocations` (number): Number of PoPs (affects cache cold-start behavior).

### 5.2 Bulk Configuration

A global "Configure Simulation" dialog accessible from the header. Sets system-wide simulation parameters:
- Simulation speed multiplier (0.25× to 4×)
- Packet visualization density (show all packets | every 10th | every 100th — for high-RPS scenarios)
- Randomness seed (same seed = same behavior every run — useful for teaching repeatability)
- Whether to show latency numbers on packets (yes/no — can be noisy)

---

## 6. Failure & Chaos Engineering Mode

**Current behavior:** Nothing ever fails. The simulation runs forever identically.

**Why this is the most important educational feature after metrics:** Students understand high availability abstractly ("you should have redundancy") but don't *feel* it until they watch a single-DB system fail completely when the database crashes while a dual-DB system degrades gracefully.

### 6.1 Manual Failure Injection

A **"Break It" mode** accessible via a toggle in the header or a right-click context menu on any component.

When "Break It" mode is active:
- Clicking any component **forces it into a failed state** (red X overlay, all connections go dark, packets error out immediately).
- Clicking again recovers it (with a configurable recovery delay of 0–60 seconds to simulate restart time).
- The metrics panel shows the impact: error rate spikes, throughput drops, latency may actually improve (requests failing fast instead of timing out).

**What students observe:**
- Single server with no LB: entire system fails. 100% error rate.
- LB + 2 servers, fail one server: LB routes around it. ~0% error rate. Perfect lesson in redundancy.
- Single DB with no replica, fail it: system stops processing writes. Perfect lesson in SPOF.
- Primary + replica, fail primary: replica promotes. Error rate spikes briefly (promotion delay). Recovers. Perfect lesson in HA vs. FT.
- Cache fails: all requests go to DB. DB becomes overloaded. Perfect lesson in cascading failure and why cache is a dependency.

### 6.2 Scheduled Chaos Events

A timeline at the bottom of the canvas (during simulation) shows time passing. At configurable timestamps, chaos events fire automatically. Students see them coming (a countdown indicator) and must prepare.

**Predefined chaos event types:**
- **Component Failure:** Specified component crashes.
- **Traffic Spike:** Client RPS multiplied by N for M seconds (models a viral moment or DDoS).
- **Slow Query:** Database query latency multiplied by 10× for M seconds (models a missing index or lock contention).
- **Memory Leak:** Cache memory fills up and starts evicting aggressively, causing hit rate to drop.
- **Network Partition:** All connections between two specified groups of components are cut (models a datacenter network issue).
- **Disk Full:** Database stops accepting writes (returns errors), reads continue.
- **Certificate Expiry:** API Gateway starts rejecting all connections (100% error rate).

### 6.3 Chaos Mode Levels

For educational levels that teach resilience:
- **Level: "Survive the Spike"** — students build an architecture, then a traffic spike fires. Did they have enough capacity? Auto-scaling? Queue to absorb the burst?
- **Level: "Kill the Database"** — students must build an architecture where failing the primary DB does not take the system down.
- **Level: "Cache Stampede"** — cache fails and all traffic hits the DB simultaneously. Students learn about thundering herd and cache warming strategies.

---

## 7. Level & Curriculum Design

The game needs a complete curriculum. Each level introduces one new concept, builds on previous levels, and has a clear learning objective. Levels should take 5–15 minutes each.

### 7.1 Level Design Principles

1. **One concept per level.** Don't introduce the message queue and horizontal scaling in the same level.
2. **Force failure, then solve it.** Show the problem first ("here's a single server — watch it die"), then teach the solution.
3. **Metrics-driven win conditions.** Don't win by placing components — win by achieving measurable outcomes: "Achieve p99 latency < 100ms" or "Handle 10,000 RPS with <1% error rate."
4. **Wrong answers have consequences.** Building a bad architecture doesn't prevent you from completing the level, but it produces poor metrics. A scoring system rewards efficient solutions.
5. **Real company context.** Each level is framed around a real scenario: "You're building Twitter's timeline service" or "This is Netflix's video delivery system." Named scenarios make concepts memorable.

### 7.2 Full Level Curriculum (30 Levels)

**Module 1: Foundations (Levels 1–5)**

*Level 1: Hello, Infrastructure!* (current)
- Goal: Build Client → LB → Web Server → SQL DB.
- Concept introduced: Three-tier architecture.
- Win condition: 3 successful packet deliveries.
- What's missing from current version: metrics, proper win condition.

*Level 2: The Bottleneck*
- Scenario: Your app has 1,000 users. The single web server is at 100% CPU.
- Starting state: Pre-built Client → Web Server → DB architecture with client set to 1,500 RPS (server max: 1,000 RPS). Server is red, errors everywhere.
- Goal: Fix it. Add a load balancer and a second web server.
- Win condition: Error rate < 1%, throughput ≥ 1,400 RPS.
- Concept introduced: Horizontal scaling, load balancing.

*Level 3: The Slow Database*
- Scenario: Your product is growing but every page load takes 800ms. Database is the culprit.
- Starting state: Pre-built fast app server, slow DB (latency: 750ms), no cache.
- Goal: Add a cache between app server and DB. Achieve p99 latency < 100ms.
- Win condition: p99 < 100ms, cache hit rate > 75%.
- Concept introduced: Caching, latency reduction.

*Level 4: Single Point of Failure*
- Scenario: It's 2am. Your database crashes. Your entire app is down. 5,000 angry users.
- Starting state: Well-designed three-tier architecture with a single DB. Chaos event fires at T+10s: DB fails.
- Goal: Before the event fires, make the architecture resilient. Add a read replica + automated failover.
- Win condition: When DB fails, error rate stays below 5% for more than 10 seconds.
- Concept introduced: High availability, replica failover, SPOF.

*Level 5: Content at Scale*
- Scenario: Your app serves millions of images. Bandwidth costs are destroying your budget.
- Starting state: Client → LB → Web Server → Object Storage. All image requests go to origin.
- Goal: Add a CDN. Reduce origin traffic by > 80%.
- Win condition: CDN hit rate > 80%, origin traffic < 20% of total.
- Concept introduced: CDN, static vs. dynamic content, origin offloading.

**Module 2: Data at Scale (Levels 6–10)**

*Level 6: The Write Bottleneck*
- Concept: SQL write scaling limits, write–read separation.
- Setup: Heavy write workload. DB at 100% capacity. Add read replica, direct read traffic to replica.

*Level 7: The Thundering Herd*
- Concept: Cache stampede (all cache keys expire simultaneously after a deployment).
- Setup: System works fine normally. After a "deployment event" (all cache cleared), all traffic hits DB simultaneously.
- Goal: Implement cache warming, staggered TTLs, or probabilistic early expiry.

*Level 8: NoSQL vs. SQL*
- Concept: When to use which.
- Setup: Two separate data types: user profiles (flexible schema, high read volume) and financial transactions (strict schema, ACID required).
- Goal: Route profile data to NoSQL, transaction data to SQL. Achieve correct error rate for each.

*Level 9: Sharding*
- Concept: Horizontal database partitioning.
- Setup: Single SQL DB at 10,000 RPS. Max capacity. Must shard.
- Goal: Set up 4 shards with a shard router. Observe load distribution.

*Level 10: The Analytics Problem*
- Concept: OLTP vs. OLAP, data warehouse.
- Setup: App DB is slow because analytics queries are running on it.
- Goal: Add a message queue + data warehouse. Route analytics reads to warehouse, operational reads to app DB.

**Module 3: Asynchronous Systems (Levels 11–15)**

*Level 11: Fire and Forget*
- Concept: Async processing, message queues.
- Setup: Email sending is blocking web server threads. 5-second delays per request.
- Goal: Decouple email sending to a queue + worker. Web server response time < 50ms.

*Level 12: Queue Depth*
- Concept: Producer/consumer balance, queue backpressure.
- Setup: Traffic spike causes queue to fill. System needs more workers.
- Goal: Auto-scale workers when queue depth > 5,000.

*Level 13: Fan-Out*
- Concept: Publish/subscribe, one event to many consumers.
- Setup: OrderPlaced event must trigger: billing, inventory, shipping, analytics — all independently.
- Goal: One queue, four consumer groups, each with its own worker pool.

*Level 14: At-Least-Once Delivery*
- Concept: Message delivery guarantees, idempotency.
- Setup: Worker crashes mid-processing. Message redelivered. If not idempotent, double-charges customer.
- Goal: Implement idempotency key check before processing.

*Level 15: Event Sourcing Intro*
- Concept: The event log as source of truth.
- Setup: Kafka topic as immutable append-only log. Multiple consumers process different projections.

**Module 4: Resilience Engineering (Levels 16–20)**

*Level 16: Cascading Failure*
- Concept: Failures propagate without circuit breakers.
- Setup: Payment service becomes slow. All threads blocked waiting. Cart service inherits slowness. Frontend times out.
- Goal: Add circuit breakers between services.

*Level 17: Rate Limiting*
- Concept: Protecting against traffic floods and abuse.
- Setup: A bot sends 100,000 RPS. System collapses.
- Goal: Add WAF + rate limiter. Legit traffic passes. Bot traffic dropped.

*Level 18: Timeouts and Retries*
- Concept: Partial failures, retry storms.
- Setup: DB occasionally has 3-second spikes. Without timeouts, requests pile up.
- Goal: Configure timeouts + exponential backoff retries with jitter.

*Level 19: Graceful Degradation*
- Concept: Non-critical features can fail without taking the core product down.
- Setup: Recommendation service goes down. Without graceful degradation, homepage errors.
- Goal: Circuit breaker on recommendation service returns cached/default recommendations instead of error.

*Level 20: The Chaos Gauntlet*
- No pre-defined scenario. Students build their own architecture, then face a random sequence of chaos events. Scored on how long they maintain 99.9% uptime.

**Module 5: Global Scale (Levels 21–25)**

*Level 21: Geographic Distribution*
- Concept: Multi-region deployment, latency zones.
- Setup: Users in Tokyo are getting 300ms p99. US-East servers are the only region.
- Goal: Add a Tokyo region (LB + servers + DB replica). Route Tokyo users to Tokyo.

*Level 22: Global Load Balancing*
- Concept: Anycast routing, GeoDNS.

*Level 23: Cross-Region Replication*
- Concept: Eventual consistency across regions, conflict resolution.

*Level 24: The Split-Brain Problem*
- Concept: Network partition between two regions with primary DB in each.

*Level 25: Zero-Downtime Deployment*
- Concept: Blue-green deployments, canary releases using weighted routing.

**Module 6: Modern Architectures (Levels 26–30)**

*Level 26: Microservices Migration*
- Concept: Strangler fig pattern, decomposing a monolith.

*Level 27: Service Mesh*
- Concept: Sidecar proxies, mTLS, observability without app changes.

*Level 28: Serverless*
- Concept: Function-as-a-Service, cold starts, event-driven invocation.

*Level 29: The ML Serving Stack*
- Concept: Feature store, model server, A/B testing, shadow traffic.

*Level 30: The Full Stack Challenge*
- Design a complete production-grade architecture for a specified system (e.g., Twitter, Uber, Netflix). Scored on: latency SLA, throughput, availability, cost efficiency, and security posture.

### 7.3 Level Format Specification

Each level should have the following data structure:

```javascript
{
  id: 'level_2',
  module: 1,
  title: 'The Bottleneck',
  tagline: 'Your single server is drowning',
  conceptTaught: 'Horizontal scaling with load balancing',
  estimatedMinutes: 10,
  
  // Pre-placed components (student cannot delete)
  lockedComponents: [
    { type: 'client', x: 100, y: 300, config: { rps: 1500 }, locked: true },
    { type: 'web_server', x: 300, y: 300, config: { maxRPS: 1000 }, locked: true },
    { type: 'sql_db', x: 500, y: 300, config: {}, locked: true },
  ],
  
  // Pre-placed connections (locked)
  lockedConnections: [
    { from: 'client', to: 'web_server' },
    { from: 'web_server', to: 'sql_db' },
  ],
  
  // Components available in palette for this level
  availableComponents: ['load_balancer', 'web_server', 'app_server'],
  
  // Win conditions (all must be met simultaneously for 10 seconds)
  winConditions: [
    { metric: 'errorRate', operator: '<', value: 0.01, description: 'Error rate < 1%' },
    { metric: 'throughput', operator: '>=', value: 1400, description: 'Throughput ≥ 1,400 RPS' },
  ],
  
  // Chaos events
  chaosEvents: [],
  
  // Hint sequence (shown progressively if student is stuck)
  hints: [
    { afterSeconds: 60, text: 'The web server is at 100% capacity. What would distribute the load?' },
    { afterSeconds: 120, text: 'Add a Load Balancer between the client and the web server.' },
    { afterSeconds: 180, text: 'Now add a second Web Server and connect the load balancer to both.' },
  ],
  
  // Teaching notes shown in the "Learn" panel
  teachingNotes: `
    When a single server reaches capacity, adding more servers (horizontal scaling) 
    is usually faster and cheaper than upgrading to a bigger server (vertical scaling).
    A load balancer distributes requests across multiple servers using round-robin or 
    least-connections algorithms...
  `
}
```

---

## 8. Canvas & UX Improvements

### 8.1 Pan & Zoom (Critical)

**Current state:** Canvas is fixed to window size. Cannot build architectures larger than the viewport.

**What to build:**
- Mouse wheel to zoom (0.25× to 4× range). Transform applied to the SVG viewBox.
- Middle-click or Space+drag to pan.
- Minimap in the bottom-right corner of the canvas showing the full architecture at 1:20 scale. Click minimap to navigate to that region.
- "Fit to screen" button that auto-zooms to show all placed components.
- Zoom level displayed in the header.

**Implementation:** Maintain a `camera = { x, y, scale }` object. All SVG rendering applies `transform="translate(${camera.x},${camera.y}) scale(${camera.scale})"` to the root group. Component positions are in world-space; rendering applies camera transform.

### 8.2 Grid Snapping

**Current state:** Components can be placed at any pixel. Creates messy, misaligned architectures.

**What to build:**
- 28px grid (matching background dot spacing).
- Components snap to nearest grid point on drag.
- Shift key disables snapping for fine positioning.
- Grid lines appear faintly when dragging a component.

### 8.3 Undo / Redo

**What to build:**
- Action history stack (max depth: 50 actions).
- Every state-mutating operation pushes a snapshot to the undo stack.
- `Ctrl+Z` / `Cmd+Z` pops the last action.
- `Ctrl+Y` / `Cmd+Y` or `Ctrl+Shift+Z` redoes.
- Operations tracked: place component, move component, delete component, create connection, delete connection, change configuration.

### 8.4 Multi-Select

**What to build:**
- Click and drag on empty canvas to rubber-band select multiple components.
- `Shift+click` to add individual components to selection.
- Move all selected components together.
- Delete all selected components together.
- `Ctrl+A` to select all.
- Visual: dashed selection box around the selected group.

### 8.5 Copy / Paste

**What to build:**
- `Ctrl+C` copies selected components (and their interconnecting connections).
- `Ctrl+V` pastes at cursor position + 20px offset (to avoid exact overlap).
- Useful for creating symmetric architectures (e.g., paste a whole server group to make a second region).

### 8.6 Delete Individual Connections

**Current state:** Connections can only be removed by deleting a component.

**What to build:**
- Hovering over a connection highlights it (stroke color changes to amber, thickness increases).
- Right-clicking a connection shows a context menu: "Delete Connection | Show traffic on this connection."
- Clicking the highlighted connection while in Delete mode removes it.
- Each connection has a hidden wider hit area (15px) for easier clicking.

### 8.7 Connection Labeling

**What to build:**
- Each connection shows a small label on hover with: traffic volume (packets/second on this edge), latency contribution, protocol (HTTP | gRPC | AMQP | TCP).
- Clicking a connection selects it and shows its details in the inspector.
- Users can manually label connections (e.g., "reads only", "writes only", "healthcheck") for documentation purposes.

### 8.8 Component Grouping / Regions

**What to build:**
- Draw a region rectangle around a set of components to label them as a logical group (e.g., "US-East", "Payment Service", "Data Layer").
- Regions are visual only — a named, colored backdrop rectangle with a label.
- Move the whole region (and its contents) together.
- Regions collapse to a single icon to save canvas space for large architectures.

### 8.9 Architecture Templates

**What to build:**
- A "Templates" button in the header that opens a gallery of pre-built architectures.
- Templates include: "Basic three-tier", "Microservices starter", "Event-driven", "CQRS", "Global CDN + origin".
- Loading a template places all components and connections, pre-configured.
- Templates are a learning shortcut — students can study existing architectures before building their own.

---

## 9. Traffic & Load Modeling

### 9.1 Traffic Patterns

**Current state:** Clients emit one packet every ~1.3 seconds, uniformly.

**What to build:**

The Client component inspector has a `Traffic Pattern` selector:

- **Steady:** Constant RPS. Simple, predictable. (Current behavior.)
- **Diurnal:** Traffic follows a sine wave over a 24-hour period (simulated in compressed time). Peak at noon, trough at 4am. Models consumer apps.
- **Spike:** Random sudden bursts — 10× normal RPS for 30–60 seconds, then returning to normal. Models viral moments, breaking news, product launches.
- **Ramp:** Linear increase from 0 to `maxRPS` over the simulation duration. Tests auto-scaling and gradual degradation.
- **Step:** Traffic increases in discrete steps every N seconds. Lets students observe exactly when each capacity limit is hit.

### 9.2 Load Events (Manual)

A "Fire Traffic Spike" button (or keyboard shortcut `F`) that immediately multiplies current RPS by a configurable factor (default: 5×) for a configurable duration (default: 30 seconds). Students can use this to stress-test their architectures interactively.

### 9.3 Request Mix Configuration

The Client inspector allows setting:
- Read/Write ratio (80/20 default)
- Heavy vs. light requests (heavy requests take more server capacity — models complex vs. simple queries)
- Authenticated vs. anonymous traffic (determines whether requests hit the auth service)

---

## 10. Connection System Overhaul

### 10.1 Connection Protocols

Each connection has a `protocol` property:

| Protocol | Typical Use | Latency |
|---|---|---|
| HTTP/REST | Service to service | Moderate |
| HTTP/2 (gRPC) | Internal microservices | Low |
| WebSocket | Real-time client push | Very low, persistent |
| AMQP | Message queue protocol | Low |
| TCP | Raw database connections | Very low |
| UDP | Real-time media, metrics | Very low, lossy |

Setting the protocol changes the visual style of the connection line (solid, dashed, thick, etc.) and the latency characteristic of packets traversing it.

### 10.2 Connection Capacity

Each connection has a `maxBandwidthRPS` property. If traffic exceeds it, packets are queued or dropped. This models: network bandwidth limits, connection pool exhaustion, I/O bottlenecks.

### 10.3 Bidirectional Connections

When response path modeling is enabled (Section 2.4), connections are bidirectional. The SVG renders two parallel lines (one in each direction) with arrows, or a single line with arrows at both ends. Response packets travel in the reverse direction.

### 10.4 Connection Reliability

Each connection has a `packetLossRate` (default: 0%) and a `jitterMs` (default: 0ms). In chaos mode:
- A network partition sets `packetLossRate = 100%` on affected connections.
- A degraded network link sets `packetLossRate = 5%` and `jitterMs = 50ms`.
- This models real WAN/internet link characteristics.

---

## 11. Save, Load & Share

### 11.1 Auto-Save to localStorage

Every state change serializes the current architecture to `localStorage` under the key `infra-sim-autosave`. On page load, offer to restore: "Restore your previous session?"

**Serialization format:**

```json
{
  "version": "1.0",
  "timestamp": "2026-06-03T12:00:00Z",
  "levelId": null,
  "components": [
    { "id": "c1", "type": "client", "x": 100, "y": 300, "label": "Mobile Client", "config": { "rps": 1000 } }
  ],
  "connections": [
    { "id": "k1", "from": "c1", "to": "c2", "protocol": "http" }
  ]
}
```

### 11.2 Named Saves

A "Save" button opens a dialog: name this architecture, save it. Multiple named saves stored in localStorage. A "My Architectures" panel shows saved designs with thumbnails (rendered as small SVG snapshots).

### 11.3 Export / Import

- **Export as JSON:** Download the serialization format above as a `.infra` file.
- **Import from JSON:** Load a `.infra` file.
- **Export as SVG:** Static SVG snapshot of the current architecture (no simulation). Useful for documentation, presentations, study notes.
- **Export as PNG:** Rasterized version of the SVG export.

### 11.4 URL Sharing

Serialize the architecture as a compressed, base64-encoded URL parameter: `https://infrasim.io/?arch=eJy7VkpJLUpVslIqS...`. Loading the URL restores the architecture. Enables:
- Sharing solutions with instructors.
- Instructors embedding pre-built scenarios in course materials.
- "Try this architecture" links in the engineering_concepts.md documentation.

---

## 12. Architecture Refactor

The current single-file approach will become unmaintainable quickly. Before adding substantial features, refactor to a proper structure.

### 12.1 Recommended File Structure

```
infrastructure_simulator/
├── index.html                  # Shell only — loads assets
├── src/
│   ├── main.js                 # Entry point, orchestration
│   ├── state/
│   │   ├── store.js            # Central state object + mutation functions
│   │   ├── history.js          # Undo/redo history stack
│   │   └── serializer.js       # Save/load/export
│   ├── components/
│   │   ├── types.js            # TYPES constant (component definitions)
│   │   ├── palette.js          # Palette UI + drag-from-palette
│   │   ├── inspector.js        # Right-panel inspector + config forms
│   │   └── canvas/
│   │       ├── renderer.js     # SVG rendering (components, connections)
│   │       ├── interaction.js  # Mouse events, drag, connect, delete
│   │       └── camera.js       # Pan/zoom camera transform
│   ├── simulation/
│   │   ├── engine.js           # Main simulation loop (animLoop, spawnCycle)
│   │   ├── packets.js          # Packet lifecycle, bezier math
│   │   ├── behaviors.js        # Per-component behavior handlers
│   │   ├── metrics.js          # Metrics collection + aggregation
│   │   └── chaos.js            # Failure injection, chaos events
│   ├── levels/
│   │   ├── registry.js         # Level list + loader
│   │   ├── goals.js            # Goal evaluation engine
│   │   └── data/
│   │       ├── level_01.js
│   │       ├── level_02.js
│   │       └── ...
│   └── ui/
│       ├── header.js           # Toolbar buttons + mode switching
│       ├── metrics-panel.js    # Bottom metrics dashboard + charts
│       ├── level-hud.js        # Goal checklist overlay
│       └── notifications.js    # Hint bar + toast messages
├── styles/
│   ├── main.css
│   ├── palette.css
│   ├── canvas.css
│   ├── inspector.css
│   └── metrics.css
├── implementation_guides/
│   └── master_implementation_guide.md
├── engineering_concepts.md
└── README.md
```

### 12.2 Build Tooling

Use Vite for development and bundling:
- Hot module replacement during development.
- Tree-shaking for the production bundle.
- Single-file output (`dist/index.html`) for distribution — the game should remain deployable as a single file.

### 12.3 State Management

Replace the global `let S = {}` object with an explicit state store using a Redux-like pattern:
- **State:** Pure data object, never mutated directly.
- **Actions:** Named operations that describe what happened (`PLACE_COMPONENT`, `CREATE_CONNECTION`, etc.).
- **Reducer:** Pure function that takes (state, action) → new state.
- **History:** Each action snapshot is pushed to the undo stack.

This enables undo/redo, time-travel debugging, and reliable serialization.

---

## 13. Scoring & Progression System

### 13.1 Level Scoring (3-Star Rating)

Each level has three tiers:

- ⭐ **Complete:** Win conditions met (any topology that satisfies the metrics).
- ⭐⭐ **Efficient:** Win conditions met using the minimum number of components.
- ⭐⭐⭐ **Optimal:** Win conditions met with metrics significantly better than required (e.g., achieve 50% better latency than the target, or use 30% fewer components).

The optimal solution for each level is pre-defined by the game designers. The scoring system compares:
1. Number of components used (fewer is better — cost efficiency).
2. Final p99 latency (lower is better).
3. Error rate (lower is better — ideally 0%).
4. Time to complete (optional — for competitive/timed modes).

### 13.2 Skill Trees

A meta-progression system showing which concepts the student has demonstrated mastery of:

```
Foundations
├── ✅ Load Balancing
├── ✅ Basic Caching
├── ⬜ Read Replicas
└── ⬜ Database Sharding

Asynchronous Systems
├── ✅ Message Queues
├── ⬜ Fan-Out Patterns
├── ⬜ Idempotent Consumers
└── ⬜ Event Sourcing

Resilience
├── ⬜ Circuit Breakers
├── ⬜ Chaos Engineering
└── ⬜ Multi-Region HA
```

Skills unlock when the corresponding level is completed with at least ⭐⭐ (Efficient). Demonstrated mastery of a concept = completing the level + correctly applying it in the free-build Sandbox mode.

### 13.3 Sandbox Mode

An unrestricted canvas with no level objectives. All components available. Full configuration system. Used for:
- Free exploration and experimentation.
- Designing and sharing real reference architectures.
- Stress-testing hypothetical systems.
- Instructor demonstrations.

Sandbox mode is unlocked after completing Level 5.

---

## 14. Implementation Priority Matrix

Work items ranked by: **educational impact × implementation feasibility / effort**.

### Phase 1 — Correctness (Build This First)

These items make the simulation educationally meaningful. Nothing else matters until these exist.

| # | Feature | Educational Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | Metrics panel (RPS, error rate, latency) | 🔴 Critical | Medium | P0 |
| 2 | Component capacity limits + overload states | 🔴 Critical | Medium | P0 |
| 3 | Packet types (read vs. write) | 🔴 Critical | Medium | P0 |
| 4 | Manual failure injection (Break It mode) | 🔴 Critical | Low | P0 |
| 5 | Latency modeling (speed proportional to latency) | 🟠 High | Medium | P0 |
| 6 | Client RPS configuration | 🔴 Critical | Low | P0 |
| 7 | Queue depth visualization | 🟠 High | Low | P1 |
| 8 | Response packets (round-trip) | 🟠 High | Medium | P1 |
| 9 | Level 2: The Bottleneck | 🔴 Critical | Medium | P1 |
| 10 | Level 3: The Slow Database | 🔴 Critical | Medium | P1 |

### Phase 2 — Usability (Make It a Real Tool)

| # | Feature | Educational Impact | Effort | Priority |
|---|---|---|---|---|
| 11 | Canvas pan/zoom | 🟠 High | Medium | P1 |
| 12 | Undo/redo | 🟡 Medium | Medium | P1 |
| 13 | Delete individual connections | 🟡 Medium | Low | P1 |
| 14 | Grid snapping | 🟡 Medium | Low | P2 |
| 15 | Component rename | 🟡 Medium | Low | P2 |
| 16 | Save/load (localStorage) | 🟠 High | Medium | P2 |
| 17 | Inspector config forms (RPS, maxRPS) | 🔴 Critical | Medium | P1 |
| 18 | Component overload visuals | 🔴 Critical | Low | P1 |
| 19 | Connection hover highlight + delete | 🟡 Medium | Low | P2 |
| 20 | Hint system (progressive, time-based) | 🟡 Medium | Medium | P2 |

### Phase 3 — Depth (Become a Serious Curriculum)

| # | Feature | Educational Impact | Effort | Priority |
|---|---|---|---|---|
| 21 | Levels 4–10 | 🔴 Critical | High | P2 |
| 22 | Chaos events (scheduled) | 🔴 Critical | Medium | P2 |
| 23 | Circuit Breaker component | 🟠 High | Medium | P2 |
| 24 | Rate Limiter component | 🟠 High | Medium | P2 |
| 25 | Read Replica component | 🟠 High | Medium | P2 |
| 26 | Traffic pattern (spike, diurnal) | 🟠 High | Medium | P2 |
| 27 | Latency histogram chart | 🟠 High | Medium | P3 |
| 28 | Multi-select + copy/paste | 🟡 Medium | Medium | P3 |
| 29 | Connection labeling | 🟡 Medium | Low | P3 |
| 30 | Architecture templates | 🟠 High | Medium | P3 |

### Phase 4 — Polish & Scale

| # | Feature | Effort | Priority |
|---|---|---|---|
| 31 | Architecture refactor (Vite, modular) | High | P3 |
| 32 | URL sharing | Medium | P3 |
| 33 | SVG/PNG export | Medium | P3 |
| 34 | Scoring + star ratings | Medium | P3 |
| 35 | Skill tree / progression | High | P4 |
| 36 | Levels 11–30 | Very High | P4 |
| 37 | Sandbox mode | Medium | P4 |
| 38 | Geographic regions visual | High | P4 |
| 39 | Data warehouse + stream processor components | Medium | P4 |
| 40 | Mobile-responsive layout | High | P4 |

---

## 15. Technical Specifications

### 15.1 Metrics Engine Specification

The metrics engine runs as part of the simulation loop. Every simulation frame:

1. For each packet that completed a round-trip this frame:
   - Record `completionTime = arrivalTime - spawnTime` (milliseconds, computed from simulation time)
   - Increment `successCount`
2. For each packet that errored (dropped/failed) this frame:
   - Increment `errorCount`
3. Every 1,000ms (1 simulation-second):
   - `rps = successCount / elapsed_real_seconds` (sliding 5-second window)
   - `errorRate = errorCount / (successCount + errorCount)` (sliding 10-second window)
   - Sort all recorded completion times; compute p50, p95, p99 using percentile function
   - Emit `MetricsUpdate` event with all values
   - Append to time-series arrays (capped at 60 data points for charts)

**Percentile function (exact, not approximate):**
```javascript
function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, idx)];
}
```

### 15.2 Component Health State Machine

Each component has a `healthState` property: `'healthy' | 'stressed' | 'overloaded' | 'failed'`.

Transitions:
```
healthy    → stressed   : currentRPS > maxRPS * 0.7
stressed   → overloaded : currentRPS > maxRPS
overloaded → stressed   : currentRPS < maxRPS
stressed   → healthy    : currentRPS < maxRPS * 0.5
any        → failed     : manual failure injection | chaos event
failed     → healthy    : manual recovery | chaos event resolved (after recoveryDelayMs)
```

In `overloaded` state: incoming packets are dropped at rate `(currentRPS - maxRPS) / currentRPS`. Dropped packets generate error packets (red) that travel back to the client.

### 15.3 Simulation Time

The simulation uses a separate `simulationTime` clock that advances based on real time × `speedMultiplier`. All time-based values (latency, queue delay, chaos event timing) are expressed in simulation-time milliseconds, not real-time milliseconds. This allows students to speed up or slow down the simulation without affecting the behavior model.

```javascript
let simTime = 0;
let lastRealTime = performance.now();

function advanceSimTime() {
  const now = performance.now();
  const realDelta = now - lastRealTime;
  simTime += realDelta * speedMultiplier;
  lastRealTime = now;
}
```

### 15.4 BFS-Based Path Validation (Already Implemented — Extend It)

The current goal validation uses BFS correctly. Extend it for Level 2+ validation:

```javascript
function findAllPaths(startId, endTypeSet) {
  // Returns array of paths (each path = array of component IDs)
  // Used for: validating topology, computing latency along specific paths,
  // and identifying which path a packet will take
}

function computePathLatency(pathIds) {
  // Sums baseLatencyMs of each component in the path
  // Returns total latency in milliseconds
}

function findBottleneck(pathIds) {
  // Returns the component with the highest currentRPS/maxRPS ratio
  // Used for: tutorial hints ("your bottleneck is the SQL DB")
}
```

### 15.5 Connection Hit Area

The current connection click detection requires clicking directly on the SVG path stroke (~2px). This is nearly impossible in practice. Fix:

```javascript
// For each connection, render two paths:
// 1. The visible path (stroke: color, width: 1.5px)
// 2. An invisible hit path (stroke: transparent, width: 15px, pointer-events: all)
// The hit path is clickable and shows hover state on the visible path via shared class
```

### 15.6 Rendering Performance

When the architecture grows to 30+ components and 50+ connections, the current full-DOM-replace-on-every-frame approach will cause jank. The packet layer (`layer-pkts`) clears and redraws every frame — this is unavoidable for animation. But `layer-comps` and `layer-conns` should only re-render when state changes (not during animation).

**Fix:**
- Add a dirty flag: `S.layoutDirty = true` when components or connections change.
- In `animLoop`, only re-render `layer-comps` and `layer-conns` if `S.layoutDirty === true`, then reset it.
- The packet layer (`layer-pkts`) always re-renders (it's the animation layer).

This reduces the work per animation frame from O(components + connections + packets) to O(packets), which is 10–100× less work.

---

*End of Master Implementation Guide.*

*This document should be updated as features are designed in more detail. Each Phase 1 item should have its own implementation spec document in this folder before development begins.*
