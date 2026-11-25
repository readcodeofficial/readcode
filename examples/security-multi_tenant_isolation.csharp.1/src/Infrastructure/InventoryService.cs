using Microsoft.EntityFrameworkCore;
using Shop.Orders.Domain;

namespace Shop.Orders.Infrastructure;

public class InventoryService(AppDbContext db)
{
    public async Task<IReadOnlyList<Product>> LowStockAsync(int threshold, CancellationToken ct)
    {
        return await db.Products
            .AsNoTracking()
            .Where(p => p.OnHand - p.Reserved < threshold)
            .OrderBy(p => p.Sku)
            .ToListAsync(ct);
    }

    // Archived products can still be reserved for orders that were placed before
    // the product was archived, so the archive filter must not apply here.
    public async Task<bool> ReserveAsync(string sku, int quantity, CancellationToken ct)
    {
        var product = await db.Products
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Sku == sku && p.OnHand - p.Reserved >= quantity, ct);
        if (product is null)
        {
            return false;
        }

        product.Reserved += quantity;
        await db.SaveChangesAsync(ct);
        return true;
    }
}
