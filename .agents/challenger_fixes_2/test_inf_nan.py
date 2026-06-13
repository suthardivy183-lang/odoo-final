import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import Product, StockAllocation, Warehouse, Aisle, Rack, Shelf

client = TestClient(app)

def test_inf_transfer():
    print("==================================================")
    print("Adversarial Test: Transfer Infinity from Infinity Source")
    print("==================================================")
    
    # Seed DB first
    seed_db()
    
    # Login
    login_response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    assert login_response.status_code == 200, "Authentication failed"
    token = login_response.json()["access_token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Setup test structure with two distinct shelves
    wh_resp = client.post("/api/warehouses", json={"name": "Transfer Wh", "location": "Test"}, headers=headers)
    wh_id = wh_resp.json()["id"]
    
    aisle_resp = client.post("/api/aisles", json={"warehouse_id": wh_id, "name": "Trans Aisle"}, headers=headers)
    aisle_id = aisle_resp.json()["id"]
    
    rack_resp = client.post("/api/racks", json={"aisle_id": aisle_id, "name": "Trans Rack"}, headers=headers)
    rack_id = rack_resp.json()["id"]
    
    shelf_resp1 = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Trans Shelf 1"}, headers=headers)
    shelf_id1 = shelf_resp1.json()["id"]
    
    shelf_resp2 = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Trans Shelf 2"}, headers=headers)
    shelf_id2 = shelf_resp2.json()["id"]

    # Get RM001
    products = client.get("/api/products", headers=headers).json()
    rm001 = [p for p in products if p["sku"] == "RM001"][0]
    rm001_id = rm001["id"]
    
    # Allocate Infinity units to Shelf 1
    client.post(
        "/api/warehouse/allocate",
        content=f'{{"product_id": {rm001_id}, "shelf_id": {shelf_id1}, "quantity": Infinity}}',
        headers=headers
    )

    # Try transferring Inf quantity from Shelf 1 to Shelf 2
    print("\n[Case 3] Transferring Inf quantity from Infinity source...")
    resp_trans_inf = client.post(
        "/api/warehouse/transfer",
        content=f'{{"product_id": {rm001_id}, "source_shelf_id": {shelf_id1}, "target_shelf_id": {shelf_id2}, "quantity": Infinity}}',
        headers=headers
    )
    print(f"Response code: {resp_trans_inf.status_code}")
    print(f"Response body: {resp_trans_inf.text}")

    # Query database
    db = SessionLocal()
    src_alloc = db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id, StockAllocation.shelf_id == shelf_id1).first()
    tgt_alloc = db.query(StockAllocation).filter(StockAllocation.product_id == rm001_id, StockAllocation.shelf_id == shelf_id2).first()
    print(f"DB Source Allocation quantity: {src_alloc.quantity if src_alloc else 'None'}")
    print(f"DB Target Allocation quantity: {tgt_alloc.quantity if tgt_alloc else 'None'}")
    db.close()

if __name__ == "__main__":
    test_inf_transfer()
