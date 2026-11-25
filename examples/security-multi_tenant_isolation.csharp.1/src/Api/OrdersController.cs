using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shop.Orders.Domain;
using Shop.Orders.Infrastructure;

namespace Shop.Orders.Api;

public record ReserveRequest(string Sku, int Quantity);

[ApiController]
[Authorize]
[Route("api/orders")]
public class OrdersController(AppDbContext db, InventoryService inventory) : ControllerBase
{
    [HttpGet("{number}")]
    public async Task<ActionResult<Order>> Get(string number, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking()
            .SingleOrDefaultAsync(o => o.Number == number, ct);
        return order is null ? NotFound() : order;
    }

    [HttpPost("{number}/reserve")]
    public async Task<IActionResult> Reserve(string number, ReserveRequest request, CancellationToken ct)
    {
        if (request.Quantity <= 0)
        {
            return BadRequest("Quantity must be positive.");
        }

        var order = await db.Orders.SingleOrDefaultAsync(o => o.Number == number, ct);
        if (order is null)
        {
            return NotFound();
        }
        if (order.Status != OrderStatus.Pending)
        {
            return Conflict("Order is not pending.");
        }

        if (!await inventory.ReserveAsync(request.Sku, request.Quantity, ct))
        {
            return Conflict("Insufficient stock.");
        }

        order.Status = OrderStatus.Reserved;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
