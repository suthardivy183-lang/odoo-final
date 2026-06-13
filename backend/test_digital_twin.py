import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import (
    Product, SalesOrder, SalesOrderLine, PurchaseOrder, PurchaseOrderLine,
    ManufacturingOrder, Warehouse, Shelf, StockAllocation, Aisle, Rack, BoM
)

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("Starting Shiv Furniture Works - Digital Twin Tests")
    print("==================================================")

    # 1. Reset and Seed Database
    print("\n[Step 1] Seeding Database...")
    seed_db()
    
    # 2. Add active orders and stock mapping
    print("\n[Step 2] Adding active orders and warehouse layout...")
    db = SessionLocal()
    try:
        # Get products
        fg_table = db.query(Product).filter(Product.sku == "FG001").first()
        rm_wood = db.query(Product).filter(Product.sku == "RM001").first()
        
        # Create Warehouse, Aisle, Rack, Shelf
        wh = Warehouse(name="Main Warehouse", location="Building A")
        db.add(wh)
        db.commit()
        
        aisle = Aisle(warehouse_id=wh.id, name="Aisle A")
        db.add(aisle)
        db.commit()
        
        rack = Rack(aisle_id=aisle.id, name="Rack 1")
        db.add(rack)
        db.commit()
        
        shelf = Shelf(rack_id=rack.id, name="Shelf 1")
        db.add(shelf)
        db.commit()
        
        # Create stock allocation for RM001 on shelf
        alloc = StockAllocation(product_id=rm_wood.id, shelf_id=shelf.id, quantity=20.0)
        db.add(alloc)
        db.commit()
        
        # Create a Sales Order for FG001
        so = SalesOrder(customer_name="Acme Corp", status="Confirmed", total_amount=3000.0)
        db.add(so)
        db.commit()
        
        line = SalesOrderLine(
            sales_order_id=so.id,
            product_id=fg_table.id,
            quantity=6.0, # We demand 6 wooden tables (which exceeds the 5.0 on hand qty of FG001!)
            unit_price=500.0,
            total_price=3000.0,
            delivered_qty=0.0
        )
        db.add(line)
        db.commit()
        
        # Create a Purchase Order for RM001
        po = PurchaseOrder(vendor_name="WoodSupplierInc", status="Ordered", total_amount=500.0)
        db.add(po)
        db.commit()
        
        po_line = PurchaseOrderLine(
            purchase_order_id=po.id,
            product_id=rm_wood.id,
            quantity=10.0,
            unit_price=50.0,
            total_price=500.0,
            received_qty=0.0
        )
        db.add(po_line)
        db.commit()
        
        # Create a Manufacturing Order for FG001
        bom = db.query(BoM).filter(BoM.product_id == fg_table.id).first()
        mo = ManufacturingOrder(
            product_id=fg_table.id,
            bom_id=bom.id,
            quantity=2.0,
            status="Planned"
        )
        db.add(mo)
        db.commit()
        
        print("[PASS] Seeded active orders and inventory.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding active orders: {e}")
        sys.exit(1)
    finally:
        db.close()

    # 3. Login
    print("\n[Step 3] Authenticating...")
    login_response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    assert login_response.status_code == 200, "Auth failed"
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Authenticated as admin.")

    # 4. Fetch Graph and verify connections
    print("\n[Step 4] Querying /api/digital-twin/graph...")
    graph_resp = client.get("/api/digital-twin/graph", headers=headers)
    assert graph_resp.status_code == 200, "Failed to retrieve graph"
    data = graph_resp.json()
    
    # Check node types exist
    nodes = data["nodes"]
    edges = data["edges"]
    summary = data["summary"]
    node_types = {n["type"] for n in nodes}
    print(f"Retrieved {len(nodes)} nodes of types: {node_types}")
    print(f"Retrieved {len(edges)} edges")
    print(f"Summary stats: {summary}")
    
    assert "customer" in node_types
    assert "product" in node_types
    assert "sales_order" in node_types
    assert "bom" in node_types
    assert "purchase_order" in node_types
    assert "manufacturing_order" in node_types
    assert "shelf" in node_types
    assert "warehouse" in node_types
    print("[PASS] Graph returns all business entities and relationships.")

    # Check edges exist
    edge_types = {e["type"] for e in edges}
    print(f"Edge types: {edge_types}")
    assert "places" in edge_types
    assert "contains" in edge_types
    assert "manufactured_via" in edge_types
    assert "requires" in edge_types
    assert "stored_at" in edge_types
    assert "located_in" in edge_types
    assert "fulfills" in edge_types
    assert "replenishes" in edge_types
    assert "supplied_by" in edge_types
    print("[PASS] Graph contains all expected relationship types.")

    # 5. Induce Shortage and assert Revenue at Risk calculation
    print("\n[Step 5] Inducing material shortage (RM001)...")
    db = SessionLocal()
    try:
        rm001 = db.query(Product).filter(Product.sku == "RM001").first()
        assert rm001 is not None, "RM001 not found"
        
        # Put inventory to 0 to simulate critical shortage
        rm001.on_hand_qty = 0.0
        # Set stock allocation also to 0
        alloc = db.query(StockAllocation).filter(StockAllocation.product_id == rm001.id).first()
        if alloc:
            alloc.quantity = 0.0
        db.commit()
    finally:
        db.close()
    print("Set RM001 on_hand_qty and StockAllocation to 0.0 in DB.")

    # Query graph again
    print("Re-querying /api/digital-twin/graph after shortage...")
    graph_resp2 = client.get("/api/digital-twin/graph", headers=headers)
    assert graph_resp2.status_code == 200
    data2 = graph_resp2.json()
    
    summary = data2["summary"]
    print(f"New Summary -> Revenue at Risk: ${summary['total_revenue_at_risk']}, Shortages: {summary['critical_shortages_count']}")
    
    assert summary["critical_shortages_count"] > 0, "No critical shortages flagged"
    assert summary["total_revenue_at_risk"] > 0.0, "Revenue at risk is 0"
    
    # Check that Sales Order is marked red
    so_nodes = [n for n in data2["nodes"] if n["type"] == "sales_order"]
    assert any(n["status"] == "red" for n in so_nodes), "No Sales Order flagged as red"
    print("[PASS] Shortage propagation and Revenue at Risk computed correctly.")

    print("\n==================================================")
    print("ALL DIGITAL TWIN TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
