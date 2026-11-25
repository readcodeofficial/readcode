import { OutOfStock } from "./inventory.js";

export async function reserveOrder(inventory, lines) {
  const reserved = [];
  const failed = [];

  lines.forEach(async (line) => {
    try {
      const hold = await inventory.reserve(line.sku, line.qty);
      reserved.push(hold);
    } catch (err) {
      if (!(err instanceof OutOfStock)) throw err;
      failed.push({ sku: line.sku, reason: err.message });
    }
  });

  return { reserved, failed };
}
