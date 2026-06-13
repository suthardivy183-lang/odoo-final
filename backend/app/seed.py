from backend.app.database import engine, Base, SessionLocal
from backend.app.models import (
    User, Product, BoM, BoMComponent, BoMOperation,
    SalesOrder, SalesOrderLine, PurchaseOrder, PurchaseOrderLine,
    ManufacturingOrder, ManufacturingOrderComponent, ManufacturingOrderOperation,
    AuditLog
)
from backend.app.auth import get_password_hash
from backend.app.utils.context import current_username

def seed_db():
    # Set context username for audit logs
    current_username.set("system_initializer")

    print("Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)

    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Seeding users...")
        users = [
            User(username="admin", password_hash=get_password_hash("admin123"), role="admin"),
            User(username="sales", password_hash=get_password_hash("sales123"), role="sales"),
            User(username="purchase", password_hash=get_password_hash("purchase123"), role="purchase"),
            User(username="inventory", password_hash=get_password_hash("inventory123"), role="inventory"),
            User(username="production", password_hash=get_password_hash("production123"), role="production"),
        ]
        db.add_all(users)
        db.commit()

        print("Seeding products...")
        # Raw materials
        rm_wood = Product(
            sku="RM001",
            name="Teak Wood Plank",
            description="Premium teak wood plank (2m x 0.2m x 0.05m)",
            category="Raw Material",
            sales_price=0.0,
            cost_price=50.0,
            on_hand_qty=20.0,
            reserved_qty=0.0,
            min_stock_level=10.0,
            is_bom_item=False,
            procure_on_demand=True,
            procurement_type="purchase",
            vendor_id="WoodSupplierInc"
        )
        rm_screws = Product(
            sku="RM002",
            name="Wood Screws (Box of 100)",
            description="1.5 inch premium zinc-plated wood screws",
            category="Raw Material",
            sales_price=0.0,
            cost_price=5.0,
            on_hand_qty=15.0,
            reserved_qty=0.0,
            min_stock_level=5.0,
            is_bom_item=False,
            procure_on_demand=True,
            procurement_type="purchase",
            vendor_id="ScrewEmporium"
        )
        rm_sandpaper = Product(
            sku="RM003",
            name="Sandpaper Sheet",
            description="180-grit silicon carbide sandpaper sheet",
            category="Raw Material",
            sales_price=0.0,
            cost_price=1.5,
            on_hand_qty=30.0,
            reserved_qty=0.0,
            min_stock_level=10.0,
            is_bom_item=False,
            procure_on_demand=True,
            procurement_type="purchase",
            vendor_id="AbrasivesDirect"
        )
        rm_varnish = Product(
            sku="RM004",
            name="Wood Varnish (1L)",
            description="Clear satin polyurethane wood varnish",
            category="Raw Material",
            sales_price=0.0,
            cost_price=12.0,
            on_hand_qty=8.0,
            reserved_qty=0.0,
            min_stock_level=3.0,
            is_bom_item=False,
            procure_on_demand=True,
            procurement_type="purchase",
            vendor_id="CoatingsLtd"
        )

        # Finished goods
        fg_table = Product(
            sku="FG001",
            name="Wooden Dining Table",
            description="Handcrafted solid teak wood dining table",
            category="Finished Good",
            sales_price=500.0,
            cost_price=260.0,
            on_hand_qty=5.0,
            reserved_qty=0.0,
            min_stock_level=2.0,
            is_bom_item=True,
            procure_on_demand=True,
            procurement_type="manufacturing",
            vendor_id=None
        )

        db.add_all([rm_wood, rm_screws, rm_sandpaper, rm_varnish, fg_table])
        db.commit()

        print("Seeding Wooden Dining Table Bill of Materials (BoM)...")
        table_bom = BoM(
            product_id=fg_table.id,
            name="Standard Teak Table BoM",
            description="Bill of materials for crafting a standard teak dining table"
        )
        db.add(table_bom)
        db.commit()

        # Update fg_table.bom_id to point to the newly created BoM
        fg_table.bom_id = table_bom.id
        db.commit()

        # Add components
        components = [
            BoMComponent(bom_id=table_bom.id, component_product_id=rm_wood.id, quantity=4.0),       # 4 planks
            BoMComponent(bom_id=table_bom.id, component_product_id=rm_screws.id, quantity=0.2),     # 20 screws (0.2 of a box)
            BoMComponent(bom_id=table_bom.id, component_product_id=rm_sandpaper.id, quantity=2.0),  # 2 sheets
            BoMComponent(bom_id=table_bom.id, component_product_id=rm_varnish.id, quantity=0.5),    # 0.5 Liters
        ]
        # Add operations
        operations = [
            BoMOperation(bom_id=table_bom.id, sequence=10, operation_name="Cutting & Shaping", work_center="Woodwork Station", standard_time_minutes=60.0),
            BoMOperation(bom_id=table_bom.id, sequence=20, operation_name="Assembly", work_center="Assembly Area", standard_time_minutes=90.0),
            BoMOperation(bom_id=table_bom.id, sequence=30, operation_name="Sanding & Varnishing", work_center="Finishing Station", standard_time_minutes=120.0),
        ]
        db.add_all(components + operations)
        db.commit()

        print("Database seeding completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
