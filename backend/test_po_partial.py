from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.models import Product, PurchaseOrder
from backend.app.database import SessionLocal

client = TestClient(app)

def test_partial_receiving():
    print("Resetting and seeding database...")
    seed_db()

    # Login
    print("Logging in...")
    login_response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch products to get IDs
    prod_resp = client.get("/api/products", headers=headers)
    products = {p["sku"]: p for p in prod_resp.json()}
    rm001 = products["RM001"]
    rm002 = products["RM002"]

    initial_rm001_qty = rm001["on_hand_qty"]
    initial_rm002_qty = rm002["on_hand_qty"]

    print(f"Initial RM001 qty: {initial_rm001_qty}, RM002 qty: {initial_rm002_qty}")

    # Create a PO with 2 lines: 10 units of RM001, 20 units of RM002
    print("Creating Purchase Order...")
    po_payload = {
        "vendor_name": "WoodSupplierInc",
        "lines": [
            {
                "product_id": rm001["id"],
                "quantity": 10.0,
                "unit_price": 50.0
            },
            {
                "product_id": rm002["id"],
                "quantity": 20.0,
                "unit_price": 5.0
            }
        ]
    }
    po_resp = client.post("/api/purchase-orders", json=po_payload, headers=headers)
    assert po_resp.status_code == 201
    po = po_resp.json()
    po_id = po["id"]
    assert po["status"] == "Draft"
    print(f"PO {po_id} created in 'Draft' status.")

    # Confirm PO
    print("Confirming Purchase Order...")
    confirm_resp = client.post(f"/api/purchase-orders/{po_id}/confirm", headers=headers)
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "Confirmed"
    print("PO status is 'Confirmed'.")

    # Receive 4 units of RM001 and 10 units of RM002 (Partially Received)
    print("Receiving partially: 4 units of RM001, 10 units of RM002...")
    receive_payload = {
        "items": [
            {"product_id": rm001["id"], "received_qty": 4.0},
            {"product_id": rm002["id"], "received_qty": 10.0}
        ]
    }
    receive_resp = client.post(f"/api/purchase-orders/{po_id}/receive", json=receive_payload, headers=headers)
    assert receive_resp.status_code == 200
    po_updated = receive_resp.json()
    assert po_updated["status"] == "Partially Received"
    print("PO status updated to 'Partially Received'.")

    # Check updated lines
    lines = {line["product_id"]: line for line in po_updated["lines"]}
    assert lines[rm001["id"]]["received_qty"] == 4.0
    assert lines[rm002["id"]]["received_qty"] == 10.0
    print("Line received quantities verified: RM001=4.0/10.0, RM002=10.0/20.0.")

    # Check product on-hand quantities
    prod_resp = client.get(f"/api/products/{rm001['id']}", headers=headers)
    assert prod_resp.json()["on_hand_qty"] == initial_rm001_qty + 4.0
    prod_resp2 = client.get(f"/api/products/{rm002['id']}", headers=headers)
    assert prod_resp2.json()["on_hand_qty"] == initial_rm002_qty + 10.0
    print("Product on-hand quantities verified.")

    # Attempt to cancel a partially received order (should fail)
    print("Attempting to cancel partially received PO (should fail)...")
    cancel_resp = client.post(f"/api/purchase-orders/{po_id}/cancel", headers=headers)
    assert cancel_resp.status_code == 400
    print("Cancel request correctly rejected with 400 Bad Request.")

    # Receive remaining quantities: 6 units of RM001 and 10 units of RM002 (Fully Received)
    print("Receiving remaining: 6 units of RM001, 10 units of RM002...")
    receive_payload2 = {
        "items": [
            {"product_id": rm001["id"], "received_qty": 6.0},
            {"product_id": rm002["id"], "received_qty": 10.0}
        ]
    }
    receive_resp2 = client.post(f"/api/purchase-orders/{po_id}/receive", json=receive_payload2, headers=headers)
    assert receive_resp2.status_code == 200
    po_final = receive_resp2.json()
    assert po_final["status"] == "Fully Received"
    print("PO status updated to 'Fully Received'.")

    # Check final lines
    lines_final = {line["product_id"]: line for line in po_final["lines"]}
    assert lines_final[rm001["id"]]["received_qty"] == 10.0
    assert lines_final[rm002["id"]]["received_qty"] == 20.0
    print("Line received quantities verified: RM001=10.0/10.0, RM002=20.0/20.0.")

    # Check product on-hand quantities again
    prod_resp = client.get(f"/api/products/{rm001['id']}", headers=headers)
    assert prod_resp.json()["on_hand_qty"] == initial_rm001_qty + 10.0
    prod_resp2 = client.get(f"/api/products/{rm002['id']}", headers=headers)
    assert prod_resp2.json()["on_hand_qty"] == initial_rm002_qty + 20.0
    print("Product final on-hand quantities verified.")

    # Attempt to receive again on fully received PO (should fail)
    print("Attempting to receive items again on a fully received PO (should fail)...")
    receive_resp3 = client.post(f"/api/purchase-orders/{po_id}/receive", json=receive_payload2, headers=headers)
    assert receive_resp3.status_code == 400
    print("Receive request correctly rejected with 400 Bad Request.")

    # Confirm audit logs have correct records
    print("Checking Audit Logs...")
    audit_resp = client.get("/api/audit-logs", headers=headers)
    logs = audit_resp.json()
    po_logs = [log for log in logs if log["entity_type"] == "Purchase Order" and f"PO-{po_id:04d}" in log["entity_name"]]
    assert len(po_logs) > 0
    print(f"Verified {len(po_logs)} audit log records for PO {po_id}.")

    print("ALL PARTIAL RECEIVING TESTS PASSED!")

if __name__ == "__main__":
    test_partial_receiving()
