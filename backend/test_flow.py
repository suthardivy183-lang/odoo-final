import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import Product, SalesOrder, PurchaseOrder, ManufacturingOrder, AuditLog

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("Starting Shiv Furniture Works - ERP Workflow Test")
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
    if login_response.status_code != 200:
        print("[FAIL] Authentication failed:", login_response.text)
        sys.exit(1)
        
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Authenticated successfully as admin.")

    # 3. Check Initial Stock
    print("\n[Step 3] Verifying Initial Product Quantities...")
    # FG001
    prod_resp = client.get("/api/products", headers=headers)
    products = {p["sku"]: p for p in prod_resp.json()}
    
    fg001 = products["FG001"]
    assert fg001["on_hand_qty"] == 5.0
    assert fg001["reserved_qty"] == 0.0
    assert fg001["free_to_use_qty"] == 5.0
    print(f"[PASS] FG001 (Wooden Table) initial stock: on_hand=5, reserved=0, free=5")

    rm001 = products["RM001"]
    assert rm001["on_hand_qty"] == 20.0
    assert rm001["reserved_qty"] == 0.0
    print(f"[PASS] RM001 (Teak Wood Plank) initial stock: on_hand=20, reserved=0")

    # 4. Create Sales Order for 12 Wooden Tables
    # Demand = 12. Stock free = 5. Shortage = 7.
    # Needs 7 * 4 = 28 Teak Wood Planks. On hand = 20. Shortage = 8.
    print("\n[Step 4] Creating Sales Order for 12 Wooden Tables...")
    so_payload = {
        "customer_name": "Delhi Furniture Mart",
        "lines": [
            {
                "product_id": fg001["id"],
                "quantity": 12.0,
                "unit_price": 500.0
            }
        ]
    }
    so_resp = client.post("/api/sales-orders", json=so_payload, headers=headers)
    assert so_resp.status_code == 201
    so_id = so_resp.json()["id"]
    print(f"[PASS] Created Draft Sales Order {so_id} for 12 tables.")

    # 5. Confirm Sales Order & Verify Procurement Triggered
    print("\n[Step 5] Confirming Sales Order and Verifying Procurement Triggers...")
    confirm_resp = client.post(f"/api/sales-orders/{so_id}/confirm", headers=headers)
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "Confirmed"
    print("[PASS] Sales Order status updated to 'Confirmed'.")

    # Verify Stock Reservations on Finished Good
    fg_resp = client.get(f"/api/products/{fg001['id']}", headers=headers)
    fg_data = fg_resp.json()
    assert fg_data["reserved_qty"] == 12.0
    assert fg_data["on_hand_qty"] == 5.0
    assert fg_data["free_to_use_qty"] == -7.0
    print(f"[PASS] FG001 stock reservations updated: on_hand=5, reserved=12, free=-7")

    # Verify Manufacturing Order (MO) Created for Shortage (7 tables)
    mo_resp = client.get("/api/manufacturing", headers=headers)
    mos = mo_resp.json()
    assert len(mos) == 1
    mo = mos[0]
    assert mo["product_id"] == fg001["id"]
    assert mo["quantity"] == 7.0
    assert mo["status"] == "Draft"
    mo_id = mo["id"]
    print(f"[PASS] Automatic Manufacturing Order {mo_id} created in 'Draft' for {mo['quantity']} units.")

    # Verify Purchase Order (PO) Created for Planks Shortage (8 planks)
    # 7 tables * 4 planks/table = 28 planks needed. On hand = 20. Shortage = 8.
    po_resp = client.get("/api/purchase-orders", headers=headers)
    pos = po_resp.json()
    assert len(pos) == 1
    po = pos[0]
    assert po["vendor_name"] == "WoodSupplierInc"
    assert po["status"] == "Draft"
    assert len(po["lines"]) == 1
    po_line = po["lines"][0]
    assert po_line["product_id"] == rm001["id"]
    assert po_line["quantity"] == 8.0
    po_id = po["id"]
    print(f"[PASS] Automatic Purchase Order {po_id} created in 'Draft' for {po_line['quantity']} planks from {po['vendor_name']}.")

    # 6. Process the Purchase Order to Receive Planks
    print("\n[Step 6] Processing Purchase Order to Receive Raw Materials...")
    # Confirm PO
    po_confirm = client.post(f"/api/purchase-orders/{po_id}/confirm", headers=headers)
    assert po_confirm.json()["status"] == "Confirmed"
    # Receive PO
    po_receive = client.post(f"/api/purchase-orders/{po_id}/receive", headers=headers)
    assert po_receive.json()["status"] == "Fully Received"
    print("[PASS] PO Confirmed and Received.")

    # Verify Planks stock increased from 20 to 28
    rm_resp = client.get(f"/api/products/{rm001['id']}", headers=headers)
    rm_data = rm_resp.json()
    assert rm_data["on_hand_qty"] == 28.0
    assert rm_data["reserved_qty"] == 0.0
    print(f"[PASS] RM001 (Teak Wood Plank) stock increased: on_hand={rm_data['on_hand_qty']}, reserved={rm_data['reserved_qty']}")

    # 7. Process the Manufacturing Order to Produce Finished Goods
    print("\n[Step 7] Processing Manufacturing Order...")
    # Confirm MO (Reserves components)
    mo_confirm = client.post(f"/api/manufacturing/{mo_id}/confirm", headers=headers)
    assert mo_confirm.json()["status"] == "Planned"
    print("[PASS] MO Confirmed and set to 'Planned'. Component stock reserved.")

    # Verify component reservations (RM001 should reserve 7 * 4 = 28 planks)
    rm_resp = client.get(f"/api/products/{rm001['id']}", headers=headers)
    assert rm_resp.json()["reserved_qty"] == 28.0
    print("[PASS] Component Planks (RM001) reserved successfully: reserved=28.0")

    # Start MO
    mo_start = client.post(f"/api/manufacturing/{mo_id}/start", headers=headers)
    assert mo_start.json()["status"] == "In Progress"
    print("[PASS] MO started and set to 'In Progress'.")

    # Complete MO (Consume components and produce finished tables)
    mo_produce = client.post(f"/api/manufacturing/{mo_id}/produce", headers=headers)
    assert mo_produce.json()["status"] == "Completed"
    print("[PASS] MO completed. Finished tables produced.")

    # Verify RM001 Planks stock is consumed (on_hand=0, reserved=0)
    rm_resp = client.get(f"/api/products/{rm001['id']}", headers=headers)
    assert rm_resp.json()["on_hand_qty"] == 0.0
    assert rm_resp.json()["reserved_qty"] == 0.0
    print("[PASS] Planks (RM001) fully consumed: on_hand=0.0, reserved=0.0")

    # Verify FG001 Tables stock is increased from 5 to 12
    fg_resp = client.get(f"/api/products/{fg001['id']}", headers=headers)
    fg_data = fg_resp.json()
    assert fg_data["on_hand_qty"] == 12.0
    assert fg_data["reserved_qty"] == 12.0
    assert fg_data["free_to_use_qty"] == 0.0
    print(f"[PASS] Finished goods (FG001) stock updated: on_hand={fg_data['on_hand_qty']}, reserved={fg_data['reserved_qty']}, free={fg_data['free_to_use_qty']}")

    # 8. Deliver Sales Order
    print("\n[Step 8] Delivering Sales Order...")
    so_deliver = client.post(f"/api/sales-orders/{so_id}/deliver", headers=headers)
    if so_deliver.status_code != 200:
        print("[FAIL] Sales Order delivery failed:", so_deliver.text)
        sys.exit(1)
    assert so_deliver.json()["status"] == "Fully Delivered"
    print("[PASS] Sales Order delivered and set to 'Fully Delivered'.")

    # Verify FG001 Tables stock is decremented and reservation is released (on_hand=0, reserved=0)
    fg_resp = client.get(f"/api/products/{fg001['id']}", headers=headers)
    fg_data = fg_resp.json()
    assert fg_data["on_hand_qty"] == 0.0
    assert fg_data["reserved_qty"] == 0.0
    assert fg_data["free_to_use_qty"] == 0.0
    print(f"[PASS] Final FG001 stock: on_hand=0.0, reserved=0.0, free=0.0")

    # 9. Verify Dashboard Statistics
    print("\n[Step 9] Verifying Dashboard Stats...")
    dash_resp = client.get("/api/dashboard", headers=headers)
    dash_data = dash_resp.json()
    assert dash_data["sales_orders"]["completed"] == 1
    assert dash_data["purchase_orders"]["received"] == 1
    assert dash_data["manufacturing_orders"]["completed"] == 1
    print("[PASS] Dashboard stats correctly reflect completed orders.")

    # 10. Verify Audit Logs
    print("\n[Step 10] Checking Audit Logs...")
    audit_resp = client.get("/api/audit-logs", headers=headers)
    logs = audit_resp.json()
    assert len(logs) > 0
    # Ensure admin user operations are recorded in logs
    admin_logs = [log for log in logs if log["username"] == "admin"]
    assert len(admin_logs) > 0
    print(f"[PASS] Successfully verified that {len(admin_logs)} database actions were audited under username 'admin'.")

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
