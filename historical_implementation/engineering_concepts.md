# Engineering Concepts: Large-Scale System Design

A field guide for engineering students, written alongside the Infrastructure Simulator game. Every component you can place in the game corresponds to a real building block used by companies like Netflix, Airbnb, Uber, and GitHub. This document explains what each one is, why it exists, how it works, and what tradeoffs it introduces.

---

## Table of Contents

1. [How the Internet Works (in 60 seconds)](#1-how-the-internet-works-in-60-seconds)
2. [The Client](#2-the-client)
3. [The CDN](#3-the-cdn)
4. [The API Gateway](#4-the-api-gateway)
5. [The Load Balancer](#5-the-load-balancer)
6. [Web Servers and App Servers](#6-web-servers-and-app-servers)
7. [The Cache](#7-the-cache)
8. [Relational Databases (SQL)](#8-relational-databases-sql)
9. [Non-Relational Databases (NoSQL)](#9-non-relational-databases-nosql)
10. [Message Queues](#10-message-queues)
11. [Workers](#11-workers)
12. [Core Theory: Scaling](#12-core-theory-scaling)
13. [Core Theory: The CAP Theorem](#13-core-theory-the-cap-theorem)
14. [Core Theory: ACID vs BASE](#14-core-theory-acid-vs-base)
15. [Core Theory: Synchronous vs Asynchronous](#15-core-theory-synchronous-vs-asynchronous)
16. [Core Theory: Stateless vs Stateful](#16-core-theory-stateless-vs-stateful)
17. [Core Theory: Single Points of Failure and High Availability](#17-core-theory-single-points-of-failure-and-high-availability)
18. [Common Architecture Patterns](#18-common-architecture-patterns)
19. [How the Simulation Models Reality](#19-how-the-simulation-models-reality)
20. [Further Reading](#20-further-reading)

---

## 1. How the Internet Works (in 60 seconds)

When you open Instagram on your phone, the following sequence of events unfolds in under 200 milliseconds:

1. Your phone (the **client**) sends an HTTP request over the internet to Instagram's servers.
2. A **DNS** server resolves "instagram.com" to an IP address.
3. The request hits a **CDN** edge node — if your profile photo is cached there, it's returned immediately.
4. Uncached requests travel to Instagram's **load balancer**, which routes them to one of hundreds of **web servers**.
5. The web server needs your follower count — it checks a **cache** (Redis). Cache hit: fast. Cache miss: query the **database**.
6. New likes and comments are written to a **message queue**, which distributes them to **worker** processes for async processing.
7. A response is assembled and returned to your phone.

The infrastructure simulator lets you build and observe exactly this kind of system. Each node in the game is a real thing that engineers design and operate every day.

---

## 2. The Client

**Game icon:** 🖥️  
**Role in simulation:** Source — generates packets continuously.

### What it is

A client is any entity that initiates a request to a system. In the broadest sense, clients include:

- Web browsers (Chrome, Firefox)
- Mobile apps (iOS, Android)
- IoT devices (smart thermostats, sensors)
- Other services calling your API (service-to-service communication)
- Automated scripts and bots

### Why it matters

The client defines your traffic model. Engineering decisions cascade from one question: *what does the client expect?*

- **Latency tolerance.** A user clicking a button expects a response in under 100ms. A nightly data export can tolerate seconds.
- **Request patterns.** A social media app has huge traffic spikes (a celebrity tweet), while a B2B SaaS has smooth weekday-only traffic.
- **Payload size.** REST API calls are tiny (kilobytes); video streaming is gigabytes per user per hour.

### The simulator

The client is the only SOURCE node. Every packet that flows through your architecture originates here. In a real system you'd model your clients carefully — peak requests per second, geographic distribution, expected growth — before designing everything downstream.

---

## 3. The CDN

**Game icon:** 🌍  
**Role in simulation:** 85% cache hit (packet absorbed); 15% miss (packet forwarded to origin).

### What it is

A Content Delivery Network is a geographically distributed network of servers ("edge nodes" or "PoPs" — Points of Presence) that cache content close to end users.

When a user in Tokyo requests a JavaScript file hosted on a server in Virginia, a CDN serves it from a node in Tokyo instead. The result: tens of milliseconds of latency instead of hundreds.

### How it works

1. A user requests `https://example.com/logo.png`.
2. The CDN checks its edge cache for that file. **Cache hit:** return immediately. **Cache miss:** fetch from the origin server, cache it, return it.
3. Subsequent users in the same region get the cached copy.

### Cache invalidation

The hardest problem in computer science (famously). You must decide:

- **TTL (Time To Live):** Cache entries expire after N seconds. Simple, but users may see stale content.
- **Cache busting:** Change the URL when content changes (`logo.v2.png`). Guaranteed fresh, but requires coordinated deployments.
- **Purge APIs:** Programmatically invalidate specific files when they change. Most CDN providers offer this.

### What CDNs offload

At scale, a CDN can absorb 80–95% of your traffic before it ever reaches your servers. Netflix serves virtually all video from CDN nodes — their origin servers handle only dynamic API calls and cache misses.

### The simulator

The CDN's 85% hit rate is a simplification of real-world behavior. In practice, hit rates vary by content type: static assets (images, fonts, CSS) hit 95%+; API responses that vary by user rarely cache at all.

---

## 4. The API Gateway

**Game icon:** 🔗  
**Role in simulation:** Routes packets to all downstream connections.

### What it is

An API Gateway is the single front door to your backend services. All client requests enter through it. It's responsible for:

- **Authentication and authorization** — Is this request from a valid user? Do they have permission?
- **Rate limiting** — This client has sent 1,000 requests in the last second. Reject the rest.
- **Request routing** — `/api/users` goes to the User Service; `/api/orders` goes to the Order Service.
- **Protocol translation** — Clients speak HTTP/REST; some backends speak gRPC or WebSockets.
- **Request/response transformation** — Reshape payloads, strip internal fields before returning to clients.
- **Observability** — Log and trace every request.

### Why it exists

Before API gateways, every service had to implement auth, rate limiting, and logging independently. With an API gateway, those concerns are centralized. Services can focus purely on business logic.

### Real-world examples

- **AWS API Gateway** — managed, serverless, integrates with Lambda
- **Kong** — open-source, extensible with plugins
- **NGINX** — originally a web server; commonly used as an API gateway/reverse proxy
- **Envoy** — high-performance proxy used by Lyft, Google

### The tradeoff

An API gateway is a **centralized bottleneck**. If it goes down, your entire API is unreachable. High availability requires running multiple gateway instances behind a load balancer — and now you need to think about who load-balances the load balancer. (Answer: anycast DNS or a cloud provider's managed infrastructure.)

---

## 5. The Load Balancer

**Game icon:** ⚖️  
**Role in simulation:** Round-robin — sends each packet to the next server in rotation.

### What it is

A load balancer distributes incoming requests across a pool of servers. Without one, you'd need a single server powerful enough to handle all traffic — which is expensive, has a ceiling, and fails catastrophically.

With a load balancer in front of ten servers, traffic is spread evenly. Any single server can go down and requests are automatically routed around it.

### Load balancing algorithms

**Round Robin** (what the simulator uses)  
Requests go to servers in order: 1, 2, 3, 1, 2, 3, ...  
Simple and effective when all requests are roughly equal in cost.

**Weighted Round Robin**  
Some servers are more powerful. A server with twice the RAM gets twice the requests: 1, 1, 2, 1, 1, 2, ...

**Least Connections**  
Route to whichever server currently has the fewest active connections. Better than round-robin when requests vary wildly in duration (some take 1ms, others take 5 seconds).

**IP Hash / Sticky Sessions**  
Always route a given client's requests to the same server. Required when server-side session state exists (though the better solution is to eliminate server-side state entirely — see Section 16).

**Layer 4 vs Layer 7**  
- **L4 (transport layer):** Routes based on IP and TCP port. Fast, but can't inspect request content.
- **L7 (application layer):** Routes based on HTTP headers, URL paths, cookies. Slower but far more flexible. Most modern load balancers are L7.

### Health checks

A load balancer periodically pings each backend server. If a server fails to respond (or responds with an error), the LB removes it from the pool. When it recovers, it's added back. This is the foundation of **automatic failover**.

### Real-world examples

- **HAProxy** — the workhorse of open-source load balancing
- **NGINX** — doubles as a web server and load balancer
- **AWS ELB / ALB** — managed cloud load balancers
- **Google Cloud Load Balancing** — global, anycast-based

### The simulator

Notice what happens when you connect a load balancer to multiple web servers: packets alternate between them in order. Add a third server and the distribution shifts. This is exactly how a real round-robin LB behaves at the request level.

---

## 6. Web Servers and App Servers

**Game icons:** 🌐 (Web Server), ⚙️ (App Server)  
**Role in simulation:** Forward packets to all outbound connections.

### The distinction (and why it's blurry)

Historically there was a clear split:

- **Web Server:** Serves static files (HTML, CSS, images). NGINX, Apache. Speaks HTTP. Very fast, very simple.
- **App Server:** Runs application code (Python, Java, Node.js). Handles dynamic requests that require computation, database queries, session management.

In modern stacks, the distinction has largely collapsed. NGINX might proxy requests to a Node.js process that handles both static and dynamic content. The terms are still useful for reasoning about architecture, even if a single binary does both jobs.

### What happens inside an app server

When a request arrives:

1. **Parse** the HTTP request (method, headers, body)
2. **Authenticate** the user (check a session token, JWT, or API key)
3. **Route** the request to the right handler function
4. **Execute business logic** (compute a price, validate an order, etc.)
5. **Query data** — check the cache first, then the database
6. **Serialize** the response (usually JSON) and return it

### The stateless principle

A well-designed app server holds **no state between requests**. Every request carries everything the server needs (authentication token, session ID). This means any server in the pool can handle any request — which is what makes horizontal scaling work.

Violating this principle (storing session state in memory on a specific server) creates "sticky session" requirements and severely limits your ability to scale.

### Horizontal scaling

Because app servers are stateless, adding capacity is trivial: spin up more instances behind the load balancer. This is horizontal scaling — adding more machines — as opposed to vertical scaling (buying a bigger machine). See Section 12 for the full picture.

---

## 7. The Cache

**Game icon:** ⚡  
**Role in simulation:** 80% hit (packet absorbed); 20% miss (packet forwarded to DB).

### What it is

A cache is an in-memory data store that sits between your application and your database. Reads from memory are orders of magnitude faster than reads from disk:

| Storage type | Typical latency |
|---|---|
| CPU L1 cache | ~0.5 ns |
| RAM (in-memory cache) | ~100 ns |
| SSD (local database) | ~100 µs |
| Network database call | ~1–10 ms |
| Spinning disk HDD | ~10 ms |

A cache hit can be 10,000× faster than a database query.

### Redis and Memcached

**Redis** is the dominant in-memory cache. It supports rich data structures (strings, lists, sets, sorted sets, hashes), atomic operations, pub/sub messaging, and optional persistence. Many companies use Redis as both a cache and a lightweight message broker.

**Memcached** is simpler — just key-value pairs. It's faster at pure read throughput but lacks Redis's features.

### Caching patterns

**Cache-aside (lazy loading)** — The application checks the cache first. On a miss, it queries the DB, writes the result to the cache, and returns it. The cache only holds data that's actually been requested.

**Write-through** — Every write goes to the cache and the database simultaneously. Cache is always up to date, but writes are slower.

**Write-behind (write-back)** — Writes go to the cache immediately; the DB is updated asynchronously. Very fast writes, but risk of data loss if the cache crashes before the async write completes.

**Read-through** — The cache sits between the app and DB and handles misses automatically. The app only talks to the cache.

### Cache eviction

Caches have limited memory. When full, they must evict entries. Common policies:

- **LRU (Least Recently Used):** Evict the entry not accessed for the longest time. Most common.
- **LFU (Least Frequently Used):** Evict the entry accessed the fewest times.
- **TTL-based:** Each entry has a fixed expiry time. Good for time-sensitive data.

### The cache hit rate

The simulator uses an 80% hit rate. What does this mean in practice? If your cache serves 80% of reads, your database sees only 20% of the load it would otherwise. At 1,000 requests/second, that's 800 cache hits and 200 database queries — the difference between a $5/month database and a $500/month one.

Most production caches target 95%+ hit rates for hot data. If your hit rate is low, your cache key design, TTL values, or cache size are probably wrong.

### What you cannot cache

- Data that must be real-time accurate (bank balances, inventory counts)
- User-specific data at high granularity (unless you key per user)
- Large binary data (impractical; use a CDN or object storage instead)

---

## 8. Relational Databases (SQL)

**Game icon:** 🗃️  
**Role in simulation:** Terminal SINK — packets are consumed (stored).

### What it is

A relational database organizes data into tables of rows and columns. Relationships between tables are expressed via foreign keys. You query data using SQL (Structured Query Language). The major systems are PostgreSQL, MySQL, SQLite, Oracle, and SQL Server.

### ACID guarantees

Every transaction in a relational database satisfies four properties:

**Atomicity** — A transaction either fully completes or fully rolls back. You can't have a bank transfer where money leaves one account but never arrives in another.

**Consistency** — The database is always in a valid state. Constraints (foreign keys, unique indexes, NOT NULL) are always enforced.

**Isolation** — Concurrent transactions don't interfere with each other. If two users try to book the last concert ticket simultaneously, only one succeeds.

**Durability** — Once a transaction is committed, it's permanent. A server crash after a commit doesn't lose the data.

ACID is the foundation of financial systems, healthcare records, e-commerce — any domain where data correctness is non-negotiable.

### Indexing

Without indexes, a query like `SELECT * FROM orders WHERE customer_id = 42` scans every row in the table — O(n). With a B-tree index on `customer_id`, it's O(log n). At millions of rows, this is the difference between 5 milliseconds and 5 seconds.

The tradeoff: indexes consume disk space and slow down writes (every write must update the index). You index columns you query on frequently, not everything.

### Scaling SQL databases

SQL databases were designed for a single machine. Scaling beyond one machine introduces complexity:

- **Read replicas:** A primary database handles writes; one or more replicas handle reads. Eventual consistency between primary and replicas. Simple to set up, very effective.
- **Sharding (horizontal partitioning):** Split data across multiple databases. Users A–M go to shard 1; N–Z go to shard 2. Complex to implement and query across shards.
- **Connection pooling:** Databases have a finite number of connections (typically 100–500). A connection pool reuses connections, preventing exhaustion under load.

### Why the simulator models SQL as a sink

In a request path, the database is the final destination for data. A request flows: client → servers → database. The response flows back in reverse. Modeling the DB as a packet sink captures this "data comes to rest here" property correctly.

---

## 9. Non-Relational Databases (NoSQL)

**Game icon:** 📊  
**Role in simulation:** Terminal SINK — packets are consumed (stored).

### What it is

NoSQL databases abandon the rigid table/row/column structure of SQL in favor of flexible data models optimized for specific access patterns. "NoSQL" is a broad umbrella covering several distinct types:

**Document stores** (MongoDB, CouchDB, Firestore)  
Store JSON-like documents. Each document can have a different structure. Great for user profiles, product catalogs, content management — anything with variable or nested structure.

**Key-value stores** (DynamoDB, Redis when used as a DB)  
Simplest possible data model: a dictionary. Extremely fast lookups by key. Used for session storage, shopping carts, feature flags.

**Wide-column stores** (Cassandra, HBase, Google Bigtable)  
Rows can have millions of different columns. Each row is identified by a row key and a timestamp. Optimized for time-series data and massive write throughput. Cassandra powers Discord's message history (billions of messages).

**Graph databases** (Neo4j, Amazon Neptune)  
Nodes and edges. Natural for social graphs (friend-of-friend queries), fraud detection, and recommendation engines.

### The BASE model

NoSQL databases typically trade ACID for BASE:

**Basically Available** — The system is always available for reads and writes, even during network partitions.

**Soft state** — State may change over time even without input (due to eventual consistency propagation).

**Eventually consistent** — Given enough time with no new writes, all replicas will converge to the same value.

Eventually consistent means: if I write a value now, another server might not see it for 50–500 milliseconds. For most applications (social feeds, product recommendations, analytics) this is completely acceptable. For bank transfers, it is not.

### When to choose NoSQL over SQL

| Situation | Use NoSQL |
|---|---|
| Schema changes frequently | ✓ (flexible document model) |
| Massive write throughput needed | ✓ (Cassandra writes fast) |
| Data is naturally hierarchical/nested | ✓ (documents fit) |
| You need to shard across 100+ nodes | ✓ (built for this) |
| ACID transactions are required | ✗ (use SQL) |
| Complex multi-table JOINs | ✗ (use SQL) |
| You don't know your query patterns yet | ✗ (use SQL first) |

The modern answer is often "both": SQL for transactional data, NoSQL for high-volume or flexible-schema data.

---

## 10. Message Queues

**Game icon:** 📨  
**Role in simulation:** Buffers packets; delivers them with a 700–1300 ms delay. Fan-out supported.

### What it is

A message queue is an intermediary that accepts messages from producers and delivers them to consumers, asynchronously. The two sides are decoupled — producers don't know or care who will consume their messages, and consumers process at their own pace.

Think of it as a postal system. The sender drops a letter in a mailbox (the queue) and goes about their day. The postal service (the queue infrastructure) delivers it. The recipient reads it when ready.

### Why it exists

**Decoupling.** When an order is placed on Amazon, the order service publishes an event: `OrderPlaced`. Dozens of downstream systems (inventory, billing, shipping, notifications, analytics) consume this event independently. None of them are directly coupled to the order service. You can add a new consumer without touching the order service.

**Absorbing spikes.** If 100,000 users sign up simultaneously, you can't send 100,000 welcome emails in parallel — your email service would collapse. Instead, enqueue 100,000 messages. Workers process them at a sustainable rate (say, 1,000/second). The queue absorbs the spike.

**Reliability.** Messages persist in the queue until successfully acknowledged. If a consumer crashes mid-processing, the message is redelivered. Nothing is lost.

**Fan-out.** One published message can be delivered to multiple consumer groups. An `OrderPlaced` event can simultaneously go to billing, warehouse, and analytics — each consuming from their own queue copy.

### Kafka vs RabbitMQ

**RabbitMQ** implements the traditional message queue model. Messages are pushed to consumers. Once acknowledged, messages are deleted. Good for task queues, job dispatch, RPC patterns.

**Apache Kafka** is a distributed log, not just a queue. Messages are retained for a configurable period (days, weeks). Consumers track their own position (offset) in the log. You can replay historical messages. Multiple consumer groups each process the full stream independently. Kafka is the backbone of streaming data pipelines at LinkedIn, Uber, Netflix, and thousands of other companies.

### Key concepts

**Producer** — Publishes messages to the queue/topic.

**Consumer** — Reads messages from the queue/topic and processes them.

**Topic / Queue** — The named channel messages flow through.

**Consumer group** — Multiple consumers collaborating to process a topic in parallel. Each message goes to exactly one consumer in the group (load-balanced delivery).

**Acknowledgment** — A consumer signals "I have successfully processed this message." Before acknowledgment, the broker holds the message for redelivery if the consumer dies.

**Dead letter queue** — Messages that fail processing after N retries go here for manual inspection. Critical for production reliability.

### The simulator

The queue's delay models asynchronous processing — packets don't flow straight through; they buffer. Connect a queue to multiple workers and watch fan-out: one message spawns multiple downstream packets.

---

## 11. Workers

**Game icon:** 👷  
**Role in simulation:** Receives packets from upstream (typically a queue); forwards to downstream.

### What it is

A worker is a background process that consumes messages from a queue and performs work — typically expensive, slow, or non-user-facing tasks. Workers are the asynchronous side of a system.

Examples of work done by workers:
- Sending emails and push notifications
- Generating PDF invoices
- Resizing uploaded images
- Training or running ML model inference
- Syncing data to third-party APIs
- Aggregating analytics events into a data warehouse

### Why separate workers from web servers

Web servers are optimized for **short-lived, interactive requests**. If a user uploads a video, you don't make them wait while your web server transcodes it. Instead:

1. Web server saves the raw file and enqueues a `TranscodeVideo` job. Returns HTTP 202 Accepted immediately.
2. A pool of workers consumes the job. Transcoding takes minutes — but the user isn't waiting.
3. When done, the worker updates the database. The client polls or receives a push notification.

This pattern — **accept work, acknowledge immediately, process asynchronously** — is the foundation of every scalable workflow engine.

### Scaling workers

Workers are stateless. Need more throughput? Run more worker instances. When the queue depth grows (messages piling up faster than they're processed), auto-scaling can spin up more workers. When the queue drains, scale back down. This is elastic, cost-efficient scaling.

---

## 12. Core Theory: Scaling

Scaling is the problem of handling more load. There are two approaches.

### Vertical Scaling (Scale Up)

Buy a bigger machine. More CPU cores, more RAM, faster disk.

**Pros:** Simple. No code changes. A single machine is easier to reason about.  
**Cons:** Has a hard ceiling — no machine is infinitely large. Single point of failure. Expensive at the top end. Downtime required to upgrade.

### Horizontal Scaling (Scale Out)

Add more machines. Run your service on 10 servers instead of 1.

**Pros:** Theoretically unlimited. Machines fail gracefully (others pick up the load). Commodity hardware is cheap.  
**Cons:** Requires your service to be stateless. Introduces distributed systems complexity (network failures, consistency, coordination).

### The 80/20 of scaling decisions

Most scaling problems are solved by, in order:

1. **Add caching** — the highest-leverage move. Reduce database load by 80–95%.
2. **Add read replicas** — scale reads without touching writes.
3. **Horizontal scale app servers** — stateless, so trivial.
4. **Shard the database** — only when you've exhausted every other option. It's complex.
5. **Rethink the data model** — sometimes the problem is algorithmic, not infrastructure.

### Throughput vs latency

- **Throughput** — how many requests per second the system can handle (a capacity measure).
- **Latency** — how long a single request takes (a time measure).

They interact but are distinct. A queue improves throughput (buffers spikes) while potentially increasing latency (messages wait). A cache improves latency (faster reads) while improving throughput (DB load decreases).

### Amdahl's Law

If a task has a portion `p` that can be parallelized and a portion `(1-p)` that cannot, the maximum speedup from adding N processors is:

```
Speedup = 1 / ((1 - p) + p/N)
```

As N → ∞, speedup → 1/(1-p). If 20% of your code must run serially, you can never go faster than 5× no matter how many servers you add. The lesson: find and eliminate serial bottlenecks before adding hardware.

---

## 13. Core Theory: The CAP Theorem

Formalized by Eric Brewer in 2000, the CAP Theorem states that a distributed system can guarantee at most **two** of three properties simultaneously:

**Consistency (C)** — Every read returns the most recent write (or an error). All nodes see the same data at the same time.

**Availability (A)** — Every request receives a response (not an error). The system is always operational.

**Partition Tolerance (P)** — The system continues operating even when network messages between nodes are lost or delayed.

In any real network, partitions happen. You cannot eliminate P. Therefore the real tradeoff is:

**CP (Consistency + Partition Tolerance):** Under a network partition, the system refuses to answer rather than return stale data. Correct, but potentially unavailable. Examples: HBase, Zookeeper.

**AP (Availability + Partition Tolerance):** Under a partition, the system returns its best available answer (possibly stale). Always responds, but may be inconsistent. Examples: Cassandra, DynamoDB, CouchDB.

### What this means in practice

Consider a distributed key-value store with two nodes. If the network link between them breaks:

- **CP choice:** Neither node accepts writes or reads. The system is correct but unavailable.
- **AP choice:** Both nodes accept writes independently, potentially diverging. When the partition heals, they must reconcile conflicts.

Most internet-scale systems choose AP. A stale profile photo is acceptable. An unavailable login page is not.

### CAP is nuanced

Modern systems exist on a spectrum, not a binary. "Tunable consistency" (Cassandra, DynamoDB) lets you choose per-operation: write to 1 replica (fast, AP) or wait for quorum (slower, CP). The CAP theorem informs the choice; it doesn't make it for you.

---

## 14. Core Theory: ACID vs BASE

This was touched on in the database sections. Here's the full picture.

| Property | ACID (SQL) | BASE (NoSQL) |
|---|---|---|
| **Focus** | Correctness | Availability |
| **Consistency** | Strong (immediate) | Eventual |
| **Transactions** | Multi-row, multi-table | Usually single-document |
| **Failure handling** | Rollback | Retry + reconcile |
| **Scaling** | Vertical (primarily) | Horizontal (natively) |
| **Best for** | Finance, healthcare, e-commerce orders | Social feeds, analytics, messaging |

Neither is superior. They solve different problems. Most large systems use both.

**Example:** Stripe uses PostgreSQL (ACID) for payment records because correctness is non-negotiable. They use Redis (AP) for rate limiting counters because an approximate count is fine — a brief over-limit is acceptable; an outage is not.

---

## 15. Core Theory: Synchronous vs Asynchronous

### Synchronous

The caller sends a request and **waits** for a response before continuing.

```
Client ──request──▶ Server
Client ◀──response── Server
(Client was blocked for the entire duration)
```

Simple to reason about. The response tells you immediately whether the operation succeeded. But if the server is slow or down, the client is stuck.

### Asynchronous

The caller sends a request and **continues without waiting**. The result arrives later (callback, webhook, polling, push notification).

```
Client ──enqueue──▶ Queue
Client continues immediately
            Queue ──deliver──▶ Worker
                   (later)
Worker ──result──▶ Database / notification
```

More complex. The client must handle the "pending" state. But it's far more resilient: the queue absorbs spikes, decouples failure domains, and enables retry logic.

### In the simulator

The **message queue** is the async boundary. Packets entering a queue are delayed before emerging — simulating the real-world behavior of async processing where work doesn't happen instantaneously.

---

## 16. Core Theory: Stateless vs Stateful

**Stateful:** The server remembers things between requests from the same client. Traditional session-based web applications store a session object in server memory.

**Problem:** If the load balancer routes request 1 to Server A (which creates the session), then routes request 2 to Server B (which has no session), the user appears logged out. You're forced into sticky sessions.

**Stateless:** The server holds no client-specific state. Every request carries all the information needed to process it — typically a signed token (JWT).

**Benefit:** Any server can handle any request. The load balancer can route freely. Servers can be added, removed, or restarted without affecting users. Horizontal scaling becomes trivial.

### The session state question

Where does state live if not on the server?

- **In the token (JWT):** The client carries their state in a signed, verifiable token. No server-side storage. But tokens can't be invalidated before expiry (a security tradeoff).
- **In a shared cache (Redis):** All servers share one Redis instance. Sessions are server-side but server-agnostic. Redis becomes a dependency — protect it.
- **In the database:** Durable, consistent, but slower than Redis.

Most modern systems use stateless JWTs for authentication and Redis for any session data that must be server-side (shopping carts, rate limit counters).

---

## 17. Core Theory: Single Points of Failure and High Availability

A **single point of failure (SPOF)** is any component whose failure takes down the entire system. A single database. A single load balancer. A single network switch.

**High Availability (HA)** is the goal of eliminating SPOFs through redundancy. The metric is usually expressed as "nines":

| Availability | Downtime per year |
|---|---|
| 99% (two nines) | 3.65 days |
| 99.9% (three nines) | 8.76 hours |
| 99.99% (four nines) | 52.6 minutes |
| 99.999% (five nines) | 5.26 minutes |

### How to achieve HA

**Redundancy:** Run N+1 instances of every critical component. If one fails, others absorb its load. The load balancer itself must be redundant (active-passive or active-active pair).

**Health checks:** Continuously verify that components are alive and responsive. Remove unhealthy instances from rotation automatically.

**Geographic distribution:** Run in multiple data centers or cloud availability zones. A fire in one data center doesn't take down your service. Data must be replicated across regions, which introduces consistency tradeoffs.

**Graceful degradation:** When a non-critical dependency fails, continue serving a degraded experience rather than failing entirely. Netflix's circuit breaker pattern: if the recommendation service is down, show generic content rather than an error page.

**Circuit breakers:** A pattern from electrical engineering. If a downstream service fails repeatedly, "open the circuit" — stop sending requests for a timeout period. This prevents cascading failures where one slow service causes all its callers to queue up requests, exhausting their resources too.

### In the simulator

If you place a single web server and it has no redundancy, your architecture has an obvious SPOF. Connect your load balancer to two or three web servers and you've eliminated that SPOF. The load balancer can still be a SPOF — in production you'd run two load balancers in active-passive failover.

---

## 18. Common Architecture Patterns

### The Three-Tier Architecture

The classic model taught in every CS program:

```
[Client] → [Presentation tier / Web server] → [Logic tier / App server] → [Data tier / Database]
```

Simple, well-understood, works well for low-to-medium scale. The simulator's Level 1 objective is essentially this.

### The Microservices Architecture

Instead of one large application, split functionality into small, independently deployable services. The Order Service only knows about orders. The User Service only knows about users. They communicate via APIs or message queues.

**Benefits:** Teams work independently. Services scale independently. Failures are contained.

**Costs:** Network calls between services add latency. Distributed transactions are hard. Debugging requires tracing requests across many services. Operational complexity is much higher.

Microservices are not always better. Many successful companies (Shopify, Stack Overflow) run large monoliths. Start with a monolith; extract services where pain demands it.

### The CQRS Pattern (Command Query Responsibility Segregation)

Separate reads from writes at the architectural level. Write commands go to a normalized, ACID-compliant SQL database. Read queries are served from a denormalized read model (NoSQL, Elasticsearch, a materialized view) optimized for the exact queries your UI needs.

Complex to set up, but dramatically improves read performance for read-heavy systems with complex query requirements.

### The Event-Driven Architecture

Components communicate by publishing and consuming events. No direct service-to-service calls. Everything flows through a message bus. The system's history is encoded as a sequence of events (Event Sourcing).

Extremely decoupled. Very resilient. Hard to debug. Hard to ensure correctness. Used extensively in financial systems and by companies like Confluent (who built Kafka).

---

## 19. How the Simulation Models Reality

The simulator is an abstraction, not a faithful simulation. Here's how the model maps to reality and where it simplifies:

| Simulator behavior | Real-world analog | Simplification |
|---|---|---|
| Packets spawn at fixed intervals | Poisson-distributed request arrivals | Real traffic is bursty and follows diurnal patterns |
| Load balancer does strict round-robin | Round-robin is one of several algorithms | Real LBs pick the algorithm based on workload type |
| Cache absorbs 80% of packets | Cache hit rate in production | Real hit rates depend on data access patterns, key design, and TTL tuning |
| CDN absorbs 85% of packets | Static asset cache hit rate | Dynamic API responses may have 0% hit rate |
| Queue adds 700–1300 ms delay | Async processing latency | Real latency depends on consumer count, message size, broker load |
| DB is a terminal sink | Database stores data and returns responses | The full request-response cycle is omitted for simplicity |
| One packet = one request | HTTP request or equivalent | Real systems measure at the byte/connection/query level |

The purpose of these simplifications is pedagogical. The ratios and behaviors are chosen to make the concepts visible. A real load balancer doesn't literally alternate requests like a metronome — but modeling it that way correctly conveys the core principle that load is distributed across multiple servers.

### What the simulation teaches that diagrams don't

Static architecture diagrams — boxes and arrows — show structure but not behavior. The simulation adds:

- **Flow dynamics.** Where do packets accumulate? Where do they speed up? This intuition is hard to build from a whiteboard diagram.
- **The effect of the cache.** Remove the cache from your architecture in the simulator and watch DB load explode. Add it back and watch the load drop. This visceral demonstration is more memorable than reading "caching reduces DB load."
- **Fan-out.** Connect one queue to three workers and watch one packet become three. This is the moment the concept clicks.
- **Bottleneck identification.** A slow DB (sink) causes packets to pile up upstream. This is exactly how a real bottleneck manifests — a growing queue depth.

---

## 20. Further Reading

These are the standard references used by working engineers to learn and deepen system design knowledge.

### Books

**Designing Data-Intensive Applications** — Martin Kleppmann  
The definitive text. Covers databases, replication, partitioning, transactions, consistency, and stream processing in depth. Read this.

**System Design Interview (Vol. 1 and 2)** — Alex Xu  
Practical walkthroughs of designing real systems (URL shortener, Instagram, Uber, YouTube) at interview depth.

**The Art of Scalability** — Martin Abbott, Michael Fisher  
Practical framework (the Scale Cube) for thinking about horizontal, functional, and data partitioning.

**Release It!** — Michael Nygard  
Patterns for building production-stable systems: circuit breakers, timeouts, bulkheads, and other stability patterns.

### Online Resources

- **High Scalability** (highscalability.com) — Architecture teardowns of real systems
- **AWS Architecture Blog** — Case studies from AWS customers
- **Martin Fowler's blog** (martinfowler.com) — Authoritative articles on microservices, CQRS, event sourcing, and patterns
- **The System Design Primer** (github.com/donnemartin/system-design-primer) — Free, comprehensive GitHub repo covering all the major topics with diagrams

### Papers (for the academically inclined)

- **Dynamo: Amazon's Highly Available Key-Value Store** (2007) — The paper that introduced consistent hashing, vector clocks, and sloppy quorums to the mainstream
- **Bigtable: A Distributed Storage System for Structured Data** (2006) — Google's wide-column store; spawned HBase and Cassandra
- **MapReduce: Simplified Data Processing on Large Clusters** (2004) — The paper that started the big data era
- **The Google File System** (2003) — Distributed file system design; inspired HDFS
- **Kafka: a Distributed Messaging System for Log Processing** (2011) — The original Kafka paper from LinkedIn

---

*This document was written to accompany the Infrastructure Simulator game. The best way to learn these concepts is to experiment: place components, connect them in different orders, observe how packet flow changes, then read about why.*
