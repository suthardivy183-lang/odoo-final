import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import Product, StockAllocation, Warehouse, Aisle, Rack, Shelf, WarehouseActivity

client = TestClient(app)

def run_boundary_tests():
    print("==================================================")
    print("Starting Warehouse Mapping Boundary & Stress Tests")
    print("==================================================")

    # 1. Reset and Seed Database
    print("\n[Setup] Resetting and Seeding Database...")
    seed_db()
    print("[PASS] Database seeded successfully.")

    # 2. Login
    print("\n[Setup] Authenticating User...")
    login_response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    assert login_response.status_code == 200, "Authentication failed"
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Authenticated successfully as admin.")

    # Setup a warehouse structure
    wh_resp = client.post("/api/warehouses", json={"name": "Boundary Wh", "location": "Sector 5"}, headers=headers)
    assert wh_resp.status_code == 201
    wh_id = wh_resp.json()["id"]

    aisle_resp = client.post("/api/aisles", json={"warehouse_id": wh_id, "name": "Aisle B1"}, headers=headers)
    assert aisle_resp.status_code == 201
    aisle_id = aisle_resp.json()["id"]

    rack_resp = client.post("/api/racks", json={"aisle_id": aisle_id, "name": "Rack B10"}, headers=headers)
    assert rack_resp.status_code == 201
    rack_id = rack_resp.json()["id"]

    shelf_resp = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Shelf B100"}, headers=headers)
    assert shelf_resp.status_code == 201
    shelf_id = shelf_resp.json()["id"]

    shelf_resp2 = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Shelf B200"}, headers=headers)
    assert shelf_resp2.status_code == 201
    shelf_id2 = shelf_resp2.json()["id"]

    products = client.get("/api/products", headers=headers).json()
    rm001 = [p for p in products if p["sku"] == "RM001"][0]
    rm001_id = rm001["id"]
    initial_rm001_qty = rm001["on_hand_qty"]

    failures = []

    # --- Test 1: Negative quantity in allocate stock ---
    print("\n[Test 1] Allocating NEGATIVE stock quantity...")
    neg_alloc_resp = client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id,
        "quantity": -5.0
    }, headers=headers)

    if neg_alloc_resp.status_code == 200:
        print("[FAIL] System allowed allocating negative quantity (-5.0).")
        # Let's verify database state
        db = SessionLocal()
        alloc = db.query(StockAllocation).filter(
            StockAllocation.product_id == rm001_id,
            StockAllocation.shelf_id == shelf_id
        ).first()
        qty_in_db = alloc.quantity if alloc else 0.0
        print(f"  -> StockAllocation quantity in DB: {qty_in_db}")
        prod = db.query(Product).filter(Product.id == rm001_id).first()
        print(f"  -> Product on_hand_qty in DB: {prod.on_hand_qty} (Initial: {initial_rm001_qty})")
        db.close()
        failures.append({
            "test": "Negative Stock Allocation",
            "finding": f"Allowed negative stock allocation (-5.0). Allocation created/updated in DB: {qty_in_db}. Product on_hand_qty reduced from {initial_rm001_qty} to {prod.on_hand_qty}."
        })
    else:
        print(f"[PASS] System rejected negative allocation. Status: {neg_alloc_resp.status_code}, Response: {neg_alloc_resp.text}")

    # Re-seed or reset allocations to keep clean state
    # Let's delete negative allocations if created, to avoid messes
    db = SessionLocal()
    db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id).delete()
    prod = db.query(Product).filter(Product.id == rm001_id).first()
    prod.on_hand_qty = initial_rm001_qty
    db.commit()
    db.close()


    # --- Test 2: Zero quantity in allocate stock ---
    print("\n[Test 2] Allocating ZERO stock quantity...")
    zero_alloc_resp = client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id,
        "quantity": 0.0
    }, headers=headers)

    if zero_alloc_resp.status_code == 200:
        print("[FAIL] System allowed allocating zero quantity (0.0).")
        db = SessionLocal()
        alloc = db.query(StockAllocation).filter(
            StockAllocation.product_id == rm001_id,
            StockAllocation.shelf_id == shelf_id
        ).first()
        qty_in_db = alloc.quantity if alloc else None
        print(f"  -> StockAllocation quantity in DB: {qty_in_db}")
        db.close()
        failures.append({
            "test": "Zero Stock Allocation",
            "finding": f"Allowed zero stock allocation. StockAllocation record created with quantity {qty_in_db}."
        })
    else:
        print(f"[PASS] System rejected zero allocation. Status: {zero_alloc_resp.status_code}")

    # Clear zero allocations
    db = SessionLocal()
    db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id).delete()
    db.commit()
    db.close()


    # --- Test 3: Allocate to non-existent shelf ---
    print("\n[Test 3] Allocating to non-existent shelf (ID 99999)...")
    non_exist_shelf_resp = client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": 99999,
        "quantity": 10.0
    }, headers=headers)

    if non_exist_shelf_resp.status_code == 404:
        print("[PASS] System correctly returned 404 for non-existent shelf.")
    else:
        print(f"[FAIL] Unexpected response for non-existent shelf: {non_exist_shelf_resp.status_code}")
        failures.append({
            "test": "Allocate to Non-existent Shelf",
            "finding": f"Expected 404 but got {non_exist_shelf_resp.status_code}. Response: {non_exist_shelf_resp.text}"
        })


    # --- Setup valid allocation for transfer tests ---
    # Allocate 10 units to Shelf B100
    client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id,
        "quantity": 10.0
    }, headers=headers)


    # --- Test 4: Negative quantity in transfer stock ---
    print("\n[Test 4] Transferring NEGATIVE quantity (-5.0)...")
    neg_transfer_resp = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id,
        "target_shelf_id": shelf_id2,
        "quantity": -5.0
    }, headers=headers)

    if neg_transfer_resp.status_code == 200:
        print("[FAIL] System allowed transferring negative quantity (-5.0).")
        db = SessionLocal()
        src_alloc = db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id, StockAllocation.shelf_id == shelf_id).first()
        tgt_alloc = db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id, StockAllocation.shelf_id == shelf_id2).first()
        print(f"  -> Source allocation quantity: {src_alloc.quantity if src_alloc else 0.0}")
        print(f"  -> Target allocation quantity: {tgt_alloc.quantity if tgt_alloc else 0.0}")
        db.close()
        failures.append({
            "test": "Negative Stock Transfer",
            "finding": f"Allowed negative stock transfer. Source quantity modified to {src_alloc.quantity if src_alloc else 0.0}, target quantity modified to {tgt_alloc.quantity if tgt_alloc else 0.0}."
        })
    else:
        print(f"[PASS] System rejected negative transfer. Status: {neg_transfer_resp.status_code}")


    # --- Test 5: Zero quantity in transfer stock ---
    print("\n[Test 5] Transferring ZERO quantity (0.0)...")
    zero_transfer_resp = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id,
        "target_shelf_id": shelf_id2,
        "quantity": 0.0
    }, headers=headers)

    if zero_transfer_resp.status_code == 200:
        # Check if it deleted or altered allocations
        print("[FAIL] System allowed transferring zero quantity (0.0) without error.")
        db = SessionLocal()
        src_alloc = db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id, StockAllocation.shelf_id == shelf_id).first()
        tgt_alloc = db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id, StockAllocation.shelf_id == shelf_id2).first()
        print(f"  -> Source allocation quantity: {src_alloc.quantity if src_alloc else 0.0}")
        print(f"  -> Target allocation quantity: {tgt_alloc.quantity if tgt_alloc else 0.0}")
        db.close()
        failures.append({
            "test": "Zero Stock Transfer",
            "finding": f"Allowed transferring zero quantity. Target allocation record might have been created unnecessarily with quantity {tgt_alloc.quantity if tgt_alloc else 0.0}."
        })
    else:
        print(f"[PASS] System rejected zero transfer. Status: {zero_transfer_resp.status_code}")


    # Reset allocation state before Test 6 to prevent contamination
    db = SessionLocal()
    db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id).delete()
    prod = db.query(Product).filter(Product.id == rm001_id).first()
    prod.on_hand_qty = initial_rm001_qty
    db.commit()
    db.close()

    # Re-allocate exactly 10.0 units to Shelf B100
    client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id,
        "quantity": 10.0
    }, headers=headers)

    # --- Test 6: Transfer exceeding stock ---
    print("\n[Test 6] Transferring quantity exceeding allocated stock (Requesting 15.0 when only 10.0 exists)...")
    excess_transfer_resp = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id,
        "target_shelf_id": shelf_id2,
        "quantity": 15.0
    }, headers=headers)

    if excess_transfer_resp.status_code == 400:
        print("[PASS] System correctly rejected transfer exceeding stock with status 400.")
    else:
        print(f"[FAIL] Expected status 400 but got {excess_transfer_resp.status_code}. Response: {excess_transfer_resp.text}")
        failures.append({
            "test": "Transfer Exceeding Stock",
            "finding": f"Expected status 400 when transferring 15.0 (only 10.0 available) but got {excess_transfer_resp.status_code}. Response: {excess_transfer_resp.text}"
        })


    # --- Test 7: Transfer from non-existent shelf or target ---
    print("\n[Test 7] Transfer from non-existent shelf...")
    non_exist_src_resp = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": 99999,
        "target_shelf_id": shelf_id2,
        "quantity": 5.0
    }, headers=headers)
    if non_exist_src_resp.status_code == 404:
        print("[PASS] System correctly returned 404 for non-existent source shelf.")
    else:
        print(f"[FAIL] Expected 404 but got {non_exist_src_resp.status_code}")
        failures.append({
            "test": "Transfer Non-existent Source Shelf",
            "finding": f"Expected 404 when source shelf does not exist, but got {non_exist_src_resp.status_code}."
        })

    print("\n[Test 7b] Transfer to non-existent shelf...")
    non_exist_tgt_resp = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "source_shelf_id": shelf_id,
        "target_shelf_id": 99999,
        "quantity": 5.0
    }, headers=headers)
    if non_exist_tgt_resp.status_code == 404:
        print("[PASS] System correctly returned 404 for non-existent target shelf.")
    else:
        print(f"[FAIL] Expected 404 but got {non_exist_tgt_resp.status_code}")
        failures.append({
            "test": "Transfer Non-existent Target Shelf",
            "finding": f"Expected 404 when target shelf does not exist, but got {non_exist_tgt_resp.status_code}."
        })


    # --- Test 8: Empty structures and duplicate elements ---
    print("\n[Test 8] Checking unique and empty structure rules...")

    # 8a. Warehouse name unique validation
    dup_wh_resp = client.post("/api/warehouses", json={"name": "Boundary Wh", "location": "Other"}, headers=headers)
    if dup_wh_resp.status_code == 400:
        print("[PASS] Duplicate warehouse name rejected.")
    else:
        print(f"[FAIL] Duplicate warehouse name allowed or gave status: {dup_wh_resp.status_code}")
        failures.append({
            "test": "Duplicate Warehouse Name",
            "finding": f"Expected 400 for duplicate warehouse name, got {dup_wh_resp.status_code}."
        })

    # 8b. Duplicate aisle name in same warehouse
    dup_aisle_resp = client.post("/api/aisles", json={"warehouse_id": wh_id, "name": "Aisle B1"}, headers=headers)
    print(f"  -> Duplicate aisle name response: {dup_aisle_resp.status_code}")
    # Let's check if there is a warning or if it just creates it
    if dup_aisle_resp.status_code == 201:
        print("[NOTE] Duplicate aisle names within the same warehouse are allowed.")

    # 8c. Empty names
    empty_wh_resp = client.post("/api/warehouses", json={"name": "", "location": ""}, headers=headers)
    if empty_wh_resp.status_code == 201:
        print("[FAIL] Allowed creating a Warehouse with an empty string name.")
        failures.append({
            "test": "Empty Warehouse Name",
            "finding": "FastAPI/Pydantic allowed creation of Warehouse with an empty name (\"\")."
        })
    else:
        print(f"[PASS] Empty warehouse name rejected or validated: {empty_wh_resp.status_code}")

    empty_aisle_resp = client.post("/api/aisles", json={"warehouse_id": wh_id, "name": ""}, headers=headers)
    if empty_aisle_resp.status_code == 201:
        print("[FAIL] Allowed creating an Aisle with an empty name.")
        failures.append({
            "test": "Empty Aisle Name",
            "finding": "Allowed creation of Aisle with an empty name (\"\")."
        })
    else:
        print(f"[PASS] Empty aisle name rejected: {empty_aisle_resp.status_code}")


    # --- Test 9: Cascade delete and on_hand_qty synchronization ---
    print("\n[Test 9] Testing cascade delete of Shelf and its impact on Product on_hand_qty...")

    # Let's check current state
    db = SessionLocal()
    prod_before = db.query(Product).filter(Product.id == rm001_id).first()
    qty_before = prod_before.on_hand_qty
    print(f"  -> Product on_hand_qty before delete: {qty_before}")

    # Check allocation in DB
    allocs = db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id).all()
    print(f"  -> Active allocations: {[(a.shelf_id, a.quantity) for a in allocs]}")
    db.close()

    # Now try to delete Shelf B100 (which has our 10.0 units allocation)
    delete_shelf_resp = client.delete(f"/api/shelves/{shelf_id}", headers=headers)
    if delete_shelf_resp.status_code == 400:
        print("[PASS] Deletion of shelf with active stock allocations correctly blocked.")
    else:
        print(f"[FAIL] Expected 400 when deleting shelf with active allocations, got {delete_shelf_resp.status_code}")
        failures.append({
            "test": "Shelf Delete Active Allocations Check",
            "finding": f"Expected 400 Bad Request when deleting shelf containing active stock allocations, but got {delete_shelf_resp.status_code}."
        })

    # To test actual deletion cascade on structural components without active allocations,
    # let's clear the allocation in the DB first.
    db = SessionLocal()
    db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id).delete()
    db.commit()
    db.close()

    # Now delete Shelf B100 (which now has NO allocations)
    delete_shelf_resp = client.delete(f"/api/shelves/{shelf_id}", headers=headers)
    assert delete_shelf_resp.status_code == 204
    print("  -> Shelf B100 successfully deleted after clearing allocations.")

    db = SessionLocal()
    # Check if stock allocation is gone
    alloc_after = db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id, StockAllocation.shelf_id == shelf_id).first()
    print(f"  -> Allocation after delete: {'Still exists' if alloc_after else 'Deleted (Cascaded)'}")
    db.close()


    # --- Test 10: Parent Existence Verification on Update ---
    print("\n[Test 10] Testing parent existence checks on update...")
    # 10a. Update Aisle to point to non-existent warehouse
    update_aisle_resp = client.put(f"/api/aisles/{aisle_id}", json={
        "warehouse_id": 99999,
        "name": "Updated Aisle Name"
    }, headers=headers)
    if update_aisle_resp.status_code == 404:
        print("[PASS] Updating Aisle with non-existent warehouse correctly returned 404.")
    else:
        print(f"[FAIL] Expected 404 when updating Aisle with non-existent warehouse, got {update_aisle_resp.status_code}")
        failures.append({
            "test": "Update Aisle with Non-existent Warehouse",
            "finding": f"Expected 404 when updating Aisle to point to non-existent warehouse, but got {update_aisle_resp.status_code}."
        })

    # 10b. Update Rack to point to non-existent aisle
    update_rack_resp = client.put(f"/api/racks/{rack_id}", json={
        "aisle_id": 99999,
        "name": "Updated Rack Name"
    }, headers=headers)
    if update_rack_resp.status_code == 404:
        print("[PASS] Updating Rack with non-existent aisle correctly returned 404.")
    else:
        print(f"[FAIL] Expected 404 when updating Rack with non-existent aisle, got {update_rack_resp.status_code}")
        failures.append({
            "test": "Update Rack with Non-existent Aisle",
            "finding": f"Expected 404 when updating Rack to point to non-existent aisle, but got {update_rack_resp.status_code}."
        })


    print("\n==================================================")
    print("SUMMARY OF BOUNDARY & STRESS TEST RESULTS")
    print(f"Total Failures/Vulnerabilities Found: {len(failures)}")
    print("==================================================")
    for f in failures:
        print(f"- [{f['test']}]")
        print(f"  {f['finding']}")
    print("==================================================")

if __name__ == "__main__":
    run_boundary_tests()
