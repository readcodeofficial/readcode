export type Lifetime = "singleton" | "scoped" | "transient";

export interface Token<T> {
  readonly description: string;
  readonly __type?: T;
}

export function token<T>(description: string): Token<T> {
  return { description };
}

interface Registration<T> {
  lifetime: Lifetime;
  factory: (c: Container) => T;
}

export class Container {
  private readonly registry: Map<Token<unknown>, Registration<unknown>>;
  private readonly cache = new Map<Token<unknown>, unknown>();
  private readonly root: Container;

  constructor(registry?: Map<Token<unknown>, Registration<unknown>>, root?: Container) {
    this.registry = registry ?? new Map();
    this.root = root ?? this;
  }

  register<T>(t: Token<T>, lifetime: Lifetime, factory: (c: Container) => T): this {
    this.registry.set(t, { lifetime, factory });
    return this;
  }

  createScope(): Container {
    return new Container(new Map(this.registry), this.root);
  }

  resolve<T>(t: Token<T>): T {
    const reg = this.registry.get(t) as Registration<T> | undefined;
    if (!reg) {
      throw new Error(`No registration for ${t.description}`);
    }

    if (reg.lifetime === "transient") {
      return reg.factory(this);
    }

    if (reg.lifetime === "scoped") {
      if (this.root === this) {
        throw new Error(`${t.description} is scoped and cannot be resolved from the root`);
      }
      if (!this.cache.has(t)) {
        this.cache.set(t, reg.factory(this));
      }
      return this.cache.get(t) as T;
    }

    if (!this.root.cache.has(t)) {
      this.root.cache.set(t, reg.factory(this));
    }
    return this.root.cache.get(t) as T;
  }
}
