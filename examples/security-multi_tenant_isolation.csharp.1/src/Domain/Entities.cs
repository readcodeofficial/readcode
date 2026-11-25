namespace Shop.Orders.Domain;

public interface ITenantOwned
{
    Guid TenantId { get; set; }
}

public enum OrderStatus { Pending, Reserved, Shipped, Cancelled }

public class Product : ITenantOwned
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Sku { get; set; } = "";
    public int OnHand { get; set; }
    public int Reserved { get; set; }
    public bool IsArchived { get; set; }
}

public class Order : ITenantOwned
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Number { get; set; } = "";
    public string CustomerEmail { get; set; } = "";
    public decimal Total { get; set; }
    public OrderStatus Status { get; set; }
}
