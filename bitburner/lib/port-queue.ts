
import { NS } from '@ns';

export type PortQueueValidator<T> = (value: unknown) => value is T;

export type PortQueueOptions<T> = {
  validator?: PortQueueValidator<T>;
  validateWrites?: boolean;
  nullValue?: string;
};

export class PortQueue<T = unknown> {
  private readonly ns: NS;
  private readonly port: number;
  private readonly validator?: PortQueueValidator<T>;
  private readonly validateWrites: boolean;
  private readonly nullValue: string;

  constructor(ns: NS, portNumber: number, options: PortQueueOptions<T> = {}) {
    this.ns = ns;
    this.port = portNumber;
    this.validator = options.validator;
    this.validateWrites = options.validateWrites ?? false;
    this.nullValue = options.nullValue ?? 'NULL PORT DATA';
  }

  write(value: T): T | null {
    if (this.validateWrites) {
      this.assertValid(value, 'write');
    }
    const result = this.ns.writePort(this.port, value);
    if (result === null) {
      return null;
    }
    return result as T;
  }

  tryWrite(value: T): boolean {
    if (this.validateWrites) {
      this.assertValid(value, 'tryWrite');
    }
    return this.ns.tryWritePort(this.port, value);
  }

  read(): T | null {
    const value = this.ns.readPort(this.port);
    return this.normalizeRead(value, 'read');
  }

  peek(): T | null {
    const value = this.ns.peek(this.port);
    return this.normalizeRead(value, 'peek');
  }

  async nextWrite(): Promise<void> {
    await this.ns.nextPortWrite(this.port);
  }

  drain(): T[] {
    const values: T[] = [];
    let value = this.read();
    while (value !== null) {
      values.push(value);
      value = this.read();
    }
    return values;
  }

  empty(): boolean {
    return this.ns.peek(this.port) === this.nullValue;
  }

  clear(): void {
    this.ns.clearPort(this.port);
  }

  portNumber(): number {
    return this.port;
  }

  private normalizeRead(value: unknown, action: 'read' | 'peek'): T | null {
    if (value === this.nullValue) {
      return null;
    }
    return this.assertValid(value, action);
  }

  private assertValid(value: unknown, action: string): T {
    if (!this.validator) {
      return value as T;
    }
    if (this.validator(value)) {
      return value;
    }
    throw new Error(`PortQueue(${this.port}) ${action} received invalid data`);
  }
}
