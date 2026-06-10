# ⚡ Infrastructure Simulator

A browser-based simulation game for learning large-scale system design. Place real infrastructure components, wire them together, and watch data packets flow through your architecture in real time.

---

## Getting Started

Open `index.html` in any modern browser — no installation or server required.

---

## How to Play

### Level 1 · Hello, Infrastructure!

Your goal is to build a basic web stack capable of handling user requests:

1. **Drag** components from the left panel onto the canvas
2. Switch to **Connect mode** (`C`) and click a source, then a destination to wire them
3. Build the chain: `Client → Load Balancer → Web Server → SQL DB`
4. Press **Space** to run the simulation — data packets will animate along your connections
5. Once packets successfully reach the database, the level is complete

The goal checklist in the top-center tracks your progress automatically.

---

## Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Select / move components | Click or drag | `S` |
| Connect two components | Connect mode, click source → target | `C` |
| Delete a component | Click in Delete mode | `D` then click, or select + `Delete` |
| Run / stop simulation | Simulate button | `Space` |
| Deselect / cancel | Click canvas | `Esc` |
| Clear canvas | Clear button | — |

---

## Components

### Traffic Layer

| Component | Role |
|---|---|
| 🖥️ **Client** | Source of all traffic. Generates packets continuously. |
| ⚖️ **Load Balancer** | Distributes requests round-robin across downstream servers. |
| 🔗 **API Gateway** | Central entry point. Handles auth, routing, and rate limiting. |
| 🌍 **CDN** | Edge cache. Serves 85% of requests instantly; forwards misses to origin. |

### Compute Layer

| Component | Role |
|---|---|
| 🌐 **Web Server** | Handles HTTP requests. Passes data queries to cache or DB. |
| ⚙️ **App Server** | Runs business logic. Stateless — scale horizontally. |
| 👷 **Worker** | Background job processor. Consumes from a message queue. |

### Data Layer

| Component | Role |
|---|---|
| ⚡ **Cache** | In-memory store (Redis). 80% hit rate; misses forward to DB. |
| 🗃️ **SQL DB** | Relational database. ACID guarantees. Terminal sink for packets. |
| 📊 **NoSQL DB** | Document/key-value store. High write throughput, eventual consistency. |

### Messaging Layer

| Component | Role |
|---|---|
| 📨 **Msg Queue** | Async broker (Kafka/RabbitMQ). Buffers packets; delivers with a delay. Fan-out supported. |

---

## Simulation Behaviors

Each component type has distinct behavior when the simulation runs:

- **Load Balancer** — strict round-robin across all outbound connections
- **Cache** — 80% of packets are absorbed (cache hit); the remaining 20% propagate downstream (cache miss)
- **CDN** — 85% hit rate; misses forward to origin
- **Message Queue** — introduces a realistic delay (700–1300 ms) before forwarding, simulating async processing
- **SQL / NoSQL DB** — terminal sinks; packets are consumed (stored), triggering the success counter
- **All others** — forward packets to every outbound connection

---

## Architecture

The entire game is a single self-contained HTML file (`index.html`) with no external dependencies. It uses:

- **SVG** for all canvas rendering (components, connections, animated packets)
- **Vanilla JavaScript** for state management, drag-and-drop, and the simulation loop
- **requestAnimationFrame** for the packet animation engine
- **CSS** for the dark-themed UI

See `engineering_concepts.md` for a deep dive into the real-world systems this game models.

---

## Project Files

```
infrastructure_simulator/
├── index.html              # The complete game
├── README.md               # This file
└── engineering_concepts.md # System design concepts guide
```
