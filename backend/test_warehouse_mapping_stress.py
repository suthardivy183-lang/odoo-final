import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import Product, ManufacturingOrder, StockAllocation, WarehouseActivity, Warehouse, Aisle, Rack, Shelf

client = TestClient(app)

def run_stress_tests():
    print("==================================================")
    print("Starting Shiv Furniture Works - Stress/Boundary Tests")
    print("==================================================")

    # Setup database
    print("\n[Prep] Resetting and Seeding Database...")
    seed_db()

    # Login
    login_response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    assert login_response.status_code == 200, "Authentication failed"
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[Prep] Authenticated successfully as admin.")

    # Create structure
    wh_resp = client.post("/api/warehouses", json={"name": "Test WH", "location": "Loc A"}, headers=headers)
    assert wh_resp.status_code == 201
    wh_id = wh_resp.json()["id"]

    aisle_resp = client.post("/api/aisles", json={"warehouse_id": wh_id, "name": "Aisle X"}, headers=headers)
    assert aisle_resp.status_code == 201
    aisle_id = aisle_resp.json()["id"]

    rack_resp = client.post("/api/racks", json={"aisle_id": aisle_id, "name": "Rack Y"}, headers=headers)
    assert rack_resp.status_code == 201
    rack_id = rack_resp.json()["id"]

    shelf_resp1 = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Shelf S1"}, headers=headers)
    assert shelf_resp1.status_code == 201
    shelf_id1 = shelf_resp1.json()["id"]

    shelf_resp2 = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Shelf S2"}, headers=headers)
    assert shelf_resp2.status_code == 201
    shelf_id2 = shelf_resp2.json()["id"]

    # Get a product ID (RM001)
    products = client.get("/api/products", headers=headers).json()
    rm001 = [p for p in products if p["sku"] == "RM001"][0]
    rm001_id = rm001["id"]
    rm001_initial_qty = rm001["on_hand_qty"]

    print(f"\n[Info] Raw material SKU: RM001, Product ID: {rm001_id}, Initial On-Hand Qty: {rm001_initial_qty}")

    errors_found = []

    # ------------------------------------------------------------
    # Test 1: Allocate Stock - Negative Quantity
    # ------------------------------------------------------------
    print("\n--- Test 1: Allocate Negative Quantity ---")
    neg_alloc_resp = client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id1,
        "quantity": -5.0
    }, headers=headers)

    if neg_alloc_resp.status_code == 200:
        print("[FAIL] Negative allocation allowed! Quantity: -5.0")
        errors_found.append("Negative allocation allowed (returned 200 instead of 400/422)")
        # Check if DB allocation was created or updated with negative
        db = SessionLocal()
        alloc = db.query(StockAllocation).filter(
            StockAllocation.product_id == rm001_id,
            StockAllocation.shelf_id == shelf_id1
        ).first()
        if alloc:
            print(f"       Created allocation qty in DB: {alloc.quantity}")
        prod = db.query(Product).filter(Product.id == rm001_id).first()
        print(f"       Product on_hand_qty in DB: {prod.on_hand_qty}")
        db.close()
    else:
        print(f"[PASS] Negative allocation blocked with status {neg_alloc_resp.status_code}")

    # ------------------------------------------------------------
    # Test 2: Allocate Stock - Zero Quantity
    # ------------------------------------------------------------
    print("\n--- Test 2: Allocate Zero Quantity ---")
    zero_alloc_resp = client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id1,
        "quantity": 0.0
    }, headers=headers)

    if zero_alloc_resp.status_code == 200:
        print("[FAIL/WARN] Zero quantity allocation allowed!")
        errors_found.append("Zero quantity allocation allowed (should be rejected as a no-op or error)")
        db = SessionLocal()
        alloc = db.query(StockAllocation).filter(
            StockAllocation.product_id == rm001_id,
            StockAllocation.shelf_id == shelf_id1
        ).first()
        if alloc:
            print(f"       Created allocation qty in DB: {alloc.quantity}")
        db.close()
    else:
        print(f"[PASS] Zero quantity allocation blocked/handled with status {zero_alloc_resp.status_code}")

    # ------------------------------------------------------------
    # Test 3: Allocate Stock - Non-existent Product
    # ------------------------------------------------------------
    print("\n--- Test 3: Allocate to Non-existent Product ---")
    non_prod_alloc = client.post("/api/warehouse/allocate", json={
        "product_id": 99999,
        "shelf_id": shelf_id1,
        "quantity": 10.0
    }, headers=headers)
    if non_prod_alloc.status_code == 404:
        print("[PASS] Blocked with 404 Not Found")
    else:
        print(f"[FAIL] Expected 404, got {non_prod_alloc.status_code}")
        errors_found.append("Allocation to non-existent product did not return 404")

    # ------------------------------------------------------------
    # Test 4: Allocate Stock - Non-existent Shelf
    # ------------------------------------------------------------
    print("\n--- Test 4: Allocate to Non-existent Shelf ---")
    non_shelf_alloc = client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": 99999,
        "quantity": 10.0
    }, headers=headers)
    if non_shelf_alloc.status_code == 404:
        print("[PASS] Blocked with 404 Not Found")
    else:
        print(f"[FAIL] Expected 404, got {non_shelf_alloc.status_code}")
        errors_found.append("Allocation to non-existent shelf did not return 404")

    # ------------------------------------------------------------
    # Setup for Transfer Tests
    # ------------------------------------------------------------
    # Clear any negative/zero allocations by reseeding database
    print("\n[Resetting DB for Transfer Tests...]")
    db = SessionLocal()
    db.query(StockAllocation).delete()
    db.commit()
    db.close()

    # Allocate 10.0 units of RM001 on shelf_id1 for transfer testing
    client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id1,
        "quantity": 10.0
    }, headers=headers)

    # ------------------------------------------------------------
    # Test 5: Transfer Stock - Exceeding Available Stock
    # ------------------------------------------------------------
    print("\n--- Test 5: Transfer Exceeding Available Stock ---")
    exceed_transfer = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id1,
        "target_shelf_id": shelf_id2,
        "quantity": 15.0
    }, headers=headers)
    if exceed_transfer.status_code == 400:
        print("[PASS] Blocked with 400 Bad Request")
    else:
        print(f"[FAIL] Expected 400, got {exceed_transfer.status_code}")
        errors_found.append("Transfer exceeding available stock did not return 400")

    # ------------------------------------------------------------
    # Test 6: Transfer Stock - Negative Quantity
    # ------------------------------------------------------------
    print("\n--- Test 6: Transfer Negative Quantity ---")
    neg_transfer = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id1,
        "target_shelf_id": shelf_id2,
        "quantity": -5.0
    }, headers=headers)

    if neg_transfer.status_code == 200:
        print("[FAIL] Negative transfer allowed! Quantity: -5.0")
        errors_found.append("Negative transfer quantity allowed (returned 200 instead of 400/422)")
        db = SessionLocal()
        s_alloc = db.query(StockAllocation).filter(
            StockAllocation.product_id == rm001_id,
            StockAllocation.shelf_id == shelf_id1
        ).first()
        t_alloc = db.query(StockAllocation).filter(
            StockAllocation.product_id == rm001_id,
            StockAllocation.shelf_id == shelf_id2
        ).first()
        print(f"       Source shelf allocation qty: {s_alloc.quantity if s_alloc else 'None'}")
        print(f"       Target shelf allocation qty: {t_alloc.quantity if t_alloc else 'None'}")
        db.close()
    else:
        print(f"[PASS] Negative transfer blocked with status {neg_transfer.status_code}")

    # ------------------------------------------------------------
    # Test 7: Transfer Stock - Zero Quantity
    # ------------------------------------------------------------
    print("\n--- Test 7: Transfer Zero Quantity ---")
    zero_transfer = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id1,
        "target_shelf_id": shelf_id2,
        "quantity": 0.0
    }, headers=headers)
    if zero_transfer.status_code == 200:
        print("[FAIL/WARN] Zero transfer allowed!")
        errors_found.append("Zero transfer quantity allowed")
    else:
        print(f"[PASS] Zero transfer blocked/handled with status {zero_transfer.status_code}")

    # ------------------------------------------------------------
    # Test 8: Transfer Stock - Same Shelf Transfer
    # ------------------------------------------------------------
    print("\n--- Test 8: Transfer to Same Shelf ---")
    same_shelf_transfer = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id1,
        "target_shelf_id": shelf_id1,
        "quantity": 5.0
    }, headers=headers)
    print(f"Response code: {same_shelf_transfer.status_code}")
    db = SessionLocal()
    alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == rm001_id,
        StockAllocation.shelf_id == shelf_id1
    ).first()
    print(f"Allocation quantity on source/target shelf: {alloc.quantity if alloc else 'DELETED!'}")
    if same_shelf_transfer.status_code == 200:
        if not alloc or alloc.quantity != 10.0:
            print("[FAIL] Transfer to same shelf corrupted the allocation!")
            errors_found.append("Transfer to same shelf corrupted the allocation (allocation changed or deleted)")
        else:
            print("[PASS] Same shelf transfer succeeded and kept quantity intact.")
    else:
        print(f"[PASS] Same shelf transfer blocked/handled with status {same_shelf_transfer.status_code}")
    db.close()

    # ------------------------------------------------------------
    # Test 9: Transfer Stock - Non-existent source shelf
    # ------------------------------------------------------------
    print("\n--- Test 9: Transfer from Non-existent Source Shelf ---")
    non_src_transfer = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": 99999,
        "target_shelf_id": shelf_id2,
        "quantity": 5.0
    }, headers=headers)
    if non_src_transfer.status_code == 404:
        print("[PASS] Blocked with 404 Not Found")
    else:
        print(f"[FAIL] Expected 404, got {non_src_transfer.status_code}")
        errors_found.append("Transfer from non-existent source shelf did not return 404")

    # ------------------------------------------------------------
    # Test 10: Transfer Stock - Non-existent target shelf
    # ------------------------------------------------------------
    print("\n--- Test 10: Transfer to Non-existent Target Shelf ---")
    non_tgt_transfer = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id1,
        "target_shelf_id": 99999,
        "quantity": 5.0
    }, headers=headers)
    if non_tgt_transfer.status_code == 404:
        print("[PASS] Blocked with 404 Not Found")
    else:
        print(f"[FAIL] Expected 404, got {non_tgt_transfer.status_code}")
        errors_found.append("Transfer to non-existent target shelf did not return 404")

    # ------------------------------------------------------------
    # Test 11: Cascade Deletion Checks
    # ------------------------------------------------------------
    # Try to delete Warehouse, should be blocked because active allocations exist
    print(f"Attempting to delete Warehouse ID: {wh_id} containing active stock allocations...")
    del_resp = client.delete(f"/api/warehouses/{wh_id}", headers=headers)
    if del_resp.status_code == 400:
        print("[PASS] Deletion of warehouse with active stock allocations correctly blocked.")
    else:
        print(f"[FAIL] Expected 400 Bad Request when deleting warehouse containing active stock allocations, got {del_resp.status_code}")
        errors_found.append("Deletion of warehouse with active stock allocations was not blocked")

    # Clear active allocations so we can test the actual cascade deletion
    db = SessionLocal()
    db.query(StockAllocation).delete()
    db.commit()
    db.close()

    # Now delete Warehouse
    print(f"Deleting Warehouse ID: {wh_id} after clearing allocations...")
    del_resp = client.delete(f"/api/warehouses/{wh_id}", headers=headers)
    assert del_resp.status_code == 204
    print("  -> Warehouse deleted successfully.")

    # Check if Aisle, Rack, Shelf, and StockAllocation are gone
    db = SessionLocal()
    aisle_exists = db.query(Aisle).filter(Aisle.id == aisle_id).first() is not None
    rack_exists = db.query(Rack).filter(Rack.id == rack_id).first() is not None
    shelf1_exists = db.query(Shelf).filter(Shelf.id == shelf_id1).first() is not None
    shelf2_exists = db.query(Shelf).filter(Shelf.id == shelf_id2).first() is not None
    alloc_exists = db.query(StockAllocation).filter(
        StockAllocation.product_id == rm001_id,
        StockAllocation.shelf_id == shelf_id1
    ).first() is not None

    print(f"Aisle exists: {aisle_exists} (Expected: False)")
    print(f"Rack exists: {rack_exists} (Expected: False)")
    print(f"Shelf 1 exists: {shelf1_exists} (Expected: False)")
    print(f"Shelf 2 exists: {shelf2_exists} (Expected: False)")
    print(f"Allocation exists: {alloc_exists} (Expected: False)")

    if aisle_exists or rack_exists or shelf1_exists or shelf2_exists or alloc_exists:
        print("[FAIL] Cascade delete failed to remove child elements!")
        errors_found.append("Cascade delete did not remove all child structural components or allocations")
    else:
        print("[PASS] Cascade deletion working correctly.")
    db.close()

    # ------------------------------------------------------------
    # Test 12: Empty Payload / Malformed Structures
    # ------------------------------------------------------------
    print("\n--- Test 12: Malformed Payload Validation ---")
    malformed_resp1 = client.post("/api/warehouse/allocate", json={}, headers=headers)
    malformed_resp2 = client.post("/api/warehouse/allocate", json={
        "product_id": "abc",
        "shelf_id": shelf_id1,
        "quantity": "xyz"
    }, headers=headers)

    if malformed_resp1.status_code == 422 and malformed_resp2.status_code == 422:
        print("[PASS] Malformed payloads blocked with 422 Unprocessable Entity")
    else:
        print(f"[FAIL] Expected 422, got {malformed_resp1.status_code} and {malformed_resp2.status_code}")
        errors_found.append("Pydantic validation of malformed fields did not return 422")

    # ------------------------------------------------------------
    # Summary of findings
    # ------------------------------------------------------------
    print("\n==================================================")
    print("Stress Testing Completed.")
    if errors_found:
        print(f"FAILURES/BUGS DETECTED: {len(errors_found)}")
        for err in errors_found:
            print(f" - {err}")
    else:
        print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_stress_tests()
