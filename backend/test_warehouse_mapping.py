import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import Product, ManufacturingOrder, StockAllocation, WarehouseActivity

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("Starting Shiv Furniture Works - Warehouse Mapping Tests")
    print("==================================================")

    # 1. Reset and Seed Database
    print("\n[Step 1] Resetting and Seeding Database...")
    seed_db()
    print("[PASS] Database seeded successfully.")

    # 2. Login
    print("\n[Step 2] Authenticating User...")
    login_response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    assert login_response.status_code == 200, "Authentication failed"
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Authenticated successfully as admin.")

    # 3. Create Warehouse Mapping Structure
    print("\n[Step 3] Creating Warehouse, Aisle, Rack, Shelf...")
    # Create Warehouse
    wh_resp = client.post("/api/warehouses", json={"name": "Main Warehouse", "location": "Building A"}, headers=headers)
    assert wh_resp.status_code == 201
    wh_id = wh_resp.json()["id"]
    print(f"[PASS] Created Warehouse ID={wh_id}")

    # Create Aisle
    aisle_resp = client.post("/api/aisles", json={"warehouse_id": wh_id, "name": "Aisle 1"}, headers=headers)
    assert aisle_resp.status_code == 201
    aisle_id = aisle_resp.json()["id"]
    print(f"[PASS] Created Aisle ID={aisle_id}")

    # Create Rack
    rack_resp = client.post("/api/racks", json={"aisle_id": aisle_id, "name": "Rack 10"}, headers=headers)
    assert rack_resp.status_code == 201
    rack_id = rack_resp.json()["id"]
    print(f"[PASS] Created Rack ID={rack_id}")

    # Create Shelf
    shelf_resp = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Shelf A1"}, headers=headers)
    assert shelf_resp.status_code == 201
    shelf_id = shelf_resp.json()["id"]
    print(f"[PASS] Created Shelf ID={shelf_id}")

    # Create another shelf for testing transfer
    shelf_resp2 = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Shelf A2"}, headers=headers)
    assert shelf_resp2.status_code == 201
    shelf_id2 = shelf_resp2.json()["id"]
    print(f"[PASS] Created Shelf ID={shelf_id2}")

    # 4. Test Optional Parent Filtering
    print("\n[Step 4] Testing Optional Parent Filtering...")
    aisles_filtered = client.get(f"/api/aisles?warehouse_id={wh_id}", headers=headers).json()
    assert len(aisles_filtered) == 1
    assert aisles_filtered[0]["id"] == aisle_id

    aisles_empty = client.get(f"/api/aisles?warehouse_id=9999", headers=headers).json()
    assert len(aisles_empty) == 0

    racks_filtered = client.get(f"/api/racks?aisle_id={aisle_id}", headers=headers).json()
    assert len(racks_filtered) == 1
    assert racks_filtered[0]["id"] == rack_id

    shelves_filtered = client.get(f"/api/shelves?rack_id={rack_id}", headers=headers).json()
    assert len(shelves_filtered) == 2
    print("[PASS] Optional parent filtering works correctly.")

    # 5. Allocate Stock
    print("\n[Step 5] Allocating Stock to Shelf A1...")
    # Get RM001 Product ID
    products = client.get("/api/products", headers=headers).json()
    rm001 = [p for p in products if p["sku"] == "RM001"][0]
    rm001_id = rm001["id"]
    initial_qty = rm001["on_hand_qty"]

    # Allocate 15 units to Shelf A1
    alloc_resp = client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id,
        "quantity": 15.0
    }, headers=headers)
    assert alloc_resp.status_code == 200
    assert alloc_resp.json()["quantity"] == 15.0
    print(f"[PASS] Allocated 15.0 units of RM001 to Shelf A1")

    # Verify product on_hand_qty increased
    product_updated = client.get(f"/api/products/{rm001_id}", headers=headers).json()
    assert product_updated["on_hand_qty"] == initial_qty + 15.0
    print(f"[PASS] Product on_hand_qty increased to {product_updated['on_hand_qty']}")

    # 6. Transfer Stock
    print("\n[Step 6] Transferring Stock from Shelf A1 to Shelf A2...")
    transfer_resp = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id,
        "target_shelf_id": shelf_id2,
        "quantity": 10.0
    }, headers=headers)
    assert transfer_resp.status_code == 200
    print("[PASS] Transferred 10.0 units from Shelf A1 to Shelf A2")

    # Verify allocation quantities
    db = SessionLocal()
    alloc1 = db.query(StockAllocation).filter(
        StockAllocation.product_id == rm001_id,
        StockAllocation.shelf_id == shelf_id
    ).first()
    assert alloc1 is not None
    assert alloc1.quantity == 5.0

    alloc2 = db.query(StockAllocation).filter(
        StockAllocation.product_id == rm001_id,
        StockAllocation.shelf_id == shelf_id2
    ).first()
    assert alloc2 is not None
    assert alloc2.quantity == 10.0
    print("[PASS] Allocation quantities verified (A1=5.0, A2=10.0)")

    # Transfer remaining 5.0 units to delete source allocation
    transfer_resp2 = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id,
        "target_shelf_id": shelf_id2,
        "quantity": 5.0
    }, headers=headers)
    assert transfer_resp2.status_code == 200

    db.close()
    db = SessionLocal()
    alloc1_deleted = db.query(StockAllocation).filter(
        StockAllocation.product_id == rm001_id,
        StockAllocation.shelf_id == shelf_id
    ).first()
    assert alloc1_deleted is None
    print("[PASS] Source allocation deleted when quantity reaches <= 0")

    # 7. Verify Warehouse Activities
    print("\n[Step 7] Verifying Warehouse Activities...")
    activities = client.get("/api/warehouse/activity", headers=headers).json()
    assert len(activities) >= 3
    # Ordered by timestamp desc: Transferred (5.0), Transferred (10.0), Allocated (15.0)
    assert activities[0]["activity_type"] == "Transferred"
    assert activities[0]["quantity"] == 5.0
    assert activities[1]["activity_type"] == "Transferred"
    assert activities[1]["quantity"] == 10.0
    assert activities[2]["activity_type"] == "Allocated"
    assert activities[2]["quantity"] == 15.0
    print("[PASS] Warehouse activities recorded and ordered correctly.")

    # 8. Test Component Storage Locations in Manufacturing Order
    print("\n[Step 8] Testing component storage locations in Manufacturing Order...")
    # Create a draft Manufacturing Order
    fg001 = [p for p in products if p["sku"] == "FG001"][0]
    mo_resp = client.post("/api/manufacturing", json={
        "product_id": fg001["id"],
        "bom_id": fg001["bom_id"],
        "quantity": 2.0
    }, headers=headers)
    assert mo_resp.status_code == 201
    mo_id = mo_resp.json()["id"]

    # Retrieve Manufacturing Order and check storage locations for components
    mo_details = client.get(f"/api/manufacturing/{mo_id}", headers=headers).json()
    rm001_comp = [c for c in mo_details["components"] if c["component_product_id"] == rm001_id][0]
    assert len(rm001_comp["storage_locations"]) == 1
    loc = rm001_comp["storage_locations"][0]
    assert loc["shelf_id"] == shelf_id2
    assert loc["shelf_name"] == "Shelf A2"
    assert loc["quantity"] == 15.0
    print("[PASS] Component storage locations correctly attached to Manufacturing Order retrieval.")

    # 9. Test sequential deduction during MO production
    print("\n[Step 9] Testing sequential stock allocation deduction during MO completion...")
    # First, let's confirm MO
    confirm_resp = client.post(f"/api/manufacturing/{mo_id}/confirm", headers=headers)
    assert confirm_resp.status_code == 200

    # Start MO
    start_resp = client.post(f"/api/manufacturing/{mo_id}/start", headers=headers)
    assert start_resp.status_code == 200

    # Let's allocate RM001 on another shelf so we have multiple allocations to deduct from sequentially.
    # We currently have 15.0 on Shelf A2. Let's allocate 10.0 on Shelf A1.
    client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id,
        "quantity": 10.0
    }, headers=headers)

    # Total allocations: Shelf A2: 15.0 (oldest), Shelf A1: 10.0 (newest).
    # MO requires 2.0 tables * 4.0 planks = 8.0 planks (RM001).
    # Since Shelf A2 is oldest (created first), we should deduct 8.0 from Shelf A2.
    # A2 should become: 15.0 - 8.0 = 7.0.
    # A1 should remain: 10.0.

    produce_resp = client.post(f"/api/manufacturing/{mo_id}/produce", headers=headers)
    assert produce_resp.status_code == 200

    # Verify allocation quantities in DB
    db.close()
    db = SessionLocal()
    alloc_a2 = db.query(StockAllocation).filter(
        StockAllocation.product_id == rm001_id,
        StockAllocation.shelf_id == shelf_id2
    ).first()
    assert alloc_a2 is not None
    assert alloc_a2.quantity == 7.0

    alloc_a1 = db.query(StockAllocation).filter(
        StockAllocation.product_id == rm001_id,
        StockAllocation.shelf_id == shelf_id
    ).first()
    assert alloc_a1 is not None
    assert alloc_a1.quantity == 10.0
    print("[PASS] Sequential deduction from oldest allocation verified successfully.")

    # Verify Consumed activity logged
    activities_new = client.get("/api/warehouse/activity", headers=headers).json()
    consumed_activities = [a for a in activities_new if a["activity_type"] == "Consumed" and a["product_id"] == rm001_id]
    assert len(consumed_activities) >= 1
    assert consumed_activities[0]["quantity"] == 8.0
    assert consumed_activities[0]["source_shelf_id"] == shelf_id2
    print("[PASS] Consumed activity logged correctly.")

    db.close()
    print("==================================================")
    print("ALL WAREHOUSE MAPPING TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
