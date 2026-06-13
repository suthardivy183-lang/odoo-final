from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from backend.app.models import Product, BoM, BoMComponent, SalesOrder, SalesOrderLine, User
from backend.app.services.insights import calculate_business_health_and_insights

def test_recursive_mrp_calculation():
    # Setup in-memory sqlite DB for isolation
    engine = create_engine("sqlite:///:memory:")
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = Session()

    try:
        # 1. Create a multi-level BOM: FG01 -> SUB01 -> RM01
        # Products
        fg = Product(
            sku="FG01", name="Finished Good 1", category="Finished Good",
            on_hand_qty=0.0, reserved_qty=0.0, is_bom_item=True
        )
        sub = Product(
            sku="SUB01", name="Sub Assembly 1", category="Finished Good",
            on_hand_qty=2.0, reserved_qty=0.0, is_bom_item=True
        )
        rm = Product(
            sku="RM01", name="Raw Material 1", category="Raw Material",
            on_hand_qty=10.0, reserved_qty=0.0, is_bom_item=False
        )
        db.add_all([fg, sub, rm])
        db.commit()

        # BoM 1: FG01 -> 2x SUB01
        bom_fg = BoM(product_id=fg.id, name="FG01 BoM")
        db.add(bom_fg)
        db.commit()
        fg.bom_id = bom_fg.id
        comp_fg_sub = BoMComponent(bom_id=bom_fg.id, component_product_id=sub.id, quantity=2.0)
        db.add(comp_fg_sub)

        # BoM 2: SUB01 -> 3x RM01
        bom_sub = BoM(product_id=sub.id, name="SUB01 BoM")
        db.add(bom_sub)
        db.commit()
        sub.bom_id = bom_sub.id
        comp_sub_rm = BoMComponent(bom_id=bom_sub.id, component_product_id=rm.id, quantity=3.0)
        db.add(comp_sub_rm)
        db.commit()

        # 2. Create Confirmed Sales Order for 5 units of FG01
        so = SalesOrder(customer_name="Test Customer", status="Confirmed")
        db.add(so)
        db.commit()
        line = SalesOrderLine(sales_order_id=so.id, product_id=fg.id, quantity=5.0, unit_price=10.0, total_price=50.0)
        db.add(line)
        db.commit()

        # 3. Calculate Insights
        res = calculate_business_health_and_insights(db)
        
        # Verify critical insights list contains RM01 shortage
        mrp_insights = [i for i in res.critical_insights if i.category == "manufacturing" and "RM01" in i.description]
        assert len(mrp_insights) == 1
        ins = mrp_insights[0]
        assert ins.required == 30.0
        assert ins.available == 10.0
        assert ins.shortage == 20.0
        assert ins.severity == "critical"
        assert ins.title == "Material shortage for Raw Material 1"
        assert ins.impact == "Fulfillment delay on confirmed sales orders, impacting customer delivery commitments."
        assert ins.recommendation == "Approve purchase order to procure RM01."

        print("SUCCESS: recursive MRP test passed.")

    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_circular_dependency():
    # Setup in-memory sqlite DB for isolation
    engine = create_engine("sqlite:///:memory:")
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = Session()

    try:
        # Circular BoM: FG -> SUB -> FG
        fg = Product(
            sku="FG01", name="Finished Good 1", category="Finished Good",
            on_hand_qty=0.0, reserved_qty=0.0, is_bom_item=True
        )
        sub = Product(
            sku="SUB01", name="Sub Assembly 1", category="Finished Good",
            on_hand_qty=0.0, reserved_qty=0.0, is_bom_item=True
        )
        db.add_all([fg, sub])
        db.commit()

        # BoM 1: FG01 -> 1x SUB01
        bom_fg = BoM(product_id=fg.id, name="FG01 BoM")
        db.add(bom_fg)
        db.commit()
        fg.bom_id = bom_fg.id
        comp_fg_sub = BoMComponent(bom_id=bom_fg.id, component_product_id=sub.id, quantity=1.0)
        db.add(comp_fg_sub)

        # BoM 2: SUB01 -> 1x FG01
        bom_sub = BoM(product_id=sub.id, name="SUB01 BoM")
        db.add(bom_sub)
        db.commit()
        sub.bom_id = bom_sub.id
        comp_sub_fg = BoMComponent(bom_id=bom_sub.id, component_product_id=fg.id, quantity=1.0)
        db.add(comp_sub_fg)
        db.commit()

        # Create Confirmed Sales Order for FG01
        so = SalesOrder(customer_name="Test Customer", status="Confirmed")
        db.add(so)
        db.commit()
        line = SalesOrderLine(sales_order_id=so.id, product_id=fg.id, quantity=5.0, unit_price=10.0, total_price=50.0)
        db.add(line)
        db.commit()

        # Calculate insights (should terminate immediately and not loop infinitely due to circular dependency check)
        calculate_business_health_and_insights(db)
        print("SUCCESS: circular dependency test passed (terminated correctly).")

    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

if __name__ == "__main__":
    test_recursive_mrp_calculation()
    test_circular_dependency()
