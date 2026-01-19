# PortQueue Design Doc

## Prelude
Bitburner Netscript ports are global, serialized queues shared across all scripts and servers in a save. They are a simple, low-ram primitive for cross-script communication. This doc proposes a `PortQueue<T>` abstraction that wraps a single port number into a typed, ergonomic queue-like interface with consistent behavior and optional runtime validation.

Goals:
- Provide a clear, reusable queue abstraction for a single port.
- Offer a simple, consistent `ns.*`-based interface.
- Support optional type validation to keep ports “single-purpose”.
- Make it easy to reason about backpressure, empty/full states, and blocking reads.

Non-goals:
- Implement multi-port multiplexing or routing (that can be a separate layer).
- Enforce global type safety beyond a single queue instance.
- Replace raw `ns.*` APIs; this is an optional wrapper.

## Use Cases
- **Worker result queue:** workers write `{host, result}` objects; controller drains and aggregates.
- **Job dispatch:** controller writes job configs; workers read and process.
- **Telemetry stream:** scripts emit metrics periodically; a dashboard script reads and displays.
- **Signal channel:** one script writes a `shutdown` message; listeners await and exit.
- **Throttling/backpressure:** writer uses `tryWrite` and reacts to a full port.

## Core Concepts
- A **port** is a FIFO queue, shared globally across all scripts.
- **Write behavior:** `write` pushes to the end; if full, it evicts the oldest entry and returns it.
- **Read behavior:** `read` pops from the front; if empty, returns `"NULL PORT DATA"`.
- **Peek behavior:** `peek` inspects the front without removing it.
- **Blocking behavior:** `nextPortWrite` (or `port.nextWrite`) sleeps until a write occurs.

## Class Design
### Type Parameters
`PortQueue<T>` uses a type parameter to express the expected payload type. Because ports can hold any data, strong typing requires convention (only writing `T` to a port) and optional runtime guards.

Optional runtime validation:
- `validator?: (value: unknown) => value is T`
- If provided, `read()` and `peek()` validate the value before returning it.
- Writes can be validated when `validateWrites` is enabled.

### State
Minimal state:
- `ns: NS` (required)
- `portNumber: number` (required)
- `validator?: (value: unknown) => value is T`
- `nullValue?: string` (default `"NULL PORT DATA"`, retained for compatibility)

No local buffering is required; all data resides in the port itself.

### API Surface (Proposed)

#### Construction
```ts
class PortQueue<T = unknown> {
  constructor(
    ns: NS,
    portNumber: number,
    options?: {
      validator?: (value: unknown) => value is T;
      validateWrites?: boolean; // default false
      nullValue?: string; // default "NULL PORT DATA"
    }
  );
}
```

#### Read/Write
- `write(value: T): T | null`
  - Wraps `ns.writePort`.
  - Returns evicted value if port was full, otherwise `null`.
- `tryWrite(value: T): boolean`
  - Wraps `ns.tryWritePort`.
  - Returns `false` if full, no eviction.
- `read(): T | null`
  - Returns next value if available; returns `null` if port empty.
  - Applies optional validation.
- `peek(): T | null`
  - Returns next value without consuming; `null` if empty.
  - Applies optional validation.
- `nextWrite(): Promise<void>`
  - Waits until a write occurs on the port.
 - `drain(): T[]`
  - Reads all currently available values and returns them as an array.

#### State Inspection
- `empty(): boolean`
  - Returns true if the port is empty.

#### Maintenance
- `clear(): void`
  - Clears all data from the port.

#### Introspection
- `portNumber(): number`
  - Returns the port number for logging/debugging.

### Behavior Notes
- `"NULL PORT DATA"` is treated as empty and mapped to `null` in the wrapper.
- `read()`/`peek()` should never return `"NULL PORT DATA"` directly.
- `write()` returns evicted value (if any), which can be useful for telemetry or debugging.
- `tryWrite()` is for backpressure-aware writers.
- `nextWrite()` can be used with `read()` loops to avoid busy-waiting.
- Invalid data handling defaults to `throw` when a validator is provided.

## Mapping to Netscript APIs
| Wrapper Method | Netscript Method |
| --- | --- |
| `write` | `ns.writePort` |
| `tryWrite` | `ns.tryWritePort` |
| `read` | `ns.readPort` |
| `peek` | `ns.peek` |
| `nextWrite` | `ns.nextPortWrite` |
| `clear` | `ns.clearPort` |
| `empty` | `ns.peek` (check for `"NULL PORT DATA"`) |

## Type Safety Strategy
Because ports accept any serializable value, strong typing is by convention:
- At compile time, `PortQueue<T>` indicates the intended payload type.
- At runtime, an optional `validator` guards reads (and optionally writes).

Recommended pattern:
- Pick a port per data type and keep it single-purpose.
- Use a validator for safety during development.
- Remove or relax validation in hot loops if performance is a concern.

Note: TypeScript interfaces are erased at runtime, so validators are not generated automatically. If you want runtime validation, provide a validator function (or use a schema library that can generate both types and validators).

Example validator:
```ts
type Job = { id: string; host: string; action: "hack" | "grow" | "weaken" };
const isJob = (v: unknown): v is Job =>
  typeof v === "object" &&
  v !== null &&
  "id" in v &&
  "host" in v &&
  "action" in v;
```

## Example Usage
```ts
import { NS } from "@ns";
import { PortQueue } from "/lib/port-queue";

type Result = { host: string; money: number };
const isResult = (v: unknown): v is Result =>
  typeof v === "object" &&
  v !== null &&
  "host" in v &&
  "money" in v;

export async function main(ns: NS) {
  const queue = new PortQueue<Result>(ns, 1, { validator: isResult });
  queue.write({ host: "n00dles", money: 123 });

  await queue.nextWrite();
  const result = queue.read();
  if (result) {
    ns.tprint(`Got ${result.host}: ${result.money}`);
  }
}
```

## Decisions
- `read()`/`peek()` return `null` when empty.
- Invalid data throws when a validator is provided.
- `write()` does not validate by default; validation is optional via `validator` and `validateWrites`.
- Include a `drain()` helper to read all available items.
