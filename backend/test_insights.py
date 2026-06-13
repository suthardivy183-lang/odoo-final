import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("Starting Shiv Furniture Works - Insights Engine Test")
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

    # 3. Query /api/insights initially
    print("\n[Step 3] Querying /api/insights endpoint initially...")
    resp = client.get("/api/insights", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    data = resp.json()
    print("[PASS] /api/insights returned 200 OK.")
    
    # 4. Validate response structure
    print("\n[Step 4] Validating response structure...")
    assert "business_health_score" in data, "business_health_score missing"
    assert isinstance(data["business_health_score"], (int, float)), "business_health_score is not number"
    assert 0 <= data["business_health_score"] <= 100, f"business_health_score out of range: {data['business_health_score']}"
    
    assert "summary" in data, "summary missing"
    assert isinstance(data["summary"], str), "summary is not string"
    assert len(data["summary"].strip()) > 0, "summary is empty"
    
    for key in ["critical_insights", "warnings", "opportunities", "successes"]:
        assert key in data, f"{key} missing"
        assert isinstance(data[key], list), f"{key} is not list"
        for item in data[key]:
            assert "severity" in item, f"severity missing in {key} item"
            assert "category" in item, f"category missing in {key} item"
            assert "title" in item, f"title missing in {key} item"
            assert "description" in item, f"description missing in {key} item"
            assert "impact" in item, f"impact missing in {key} item"
            assert "recommendation" in item, f"recommendation missing in {key} item"
            assert "confidence" in item, f"confidence missing in {key} item"
            assert isinstance(item["confidence"], int), f"confidence is not int in {key} item"
            assert 0 <= item["confidence"] <= 100, f"confidence out of range in {key} item"

    print("[PASS] Response structure validated successfully.")
    print(f"Initial Health Score: {data['business_health_score']}%")
    print(f"Initial Summary: {data['summary']}")
    print(f"Initial Critical Insights Count: {len(data['critical_insights'])}")
    print(f"Initial Warnings Count: {len(data['warnings'])}")
    print(f"Initial Opportunities Count: {len(data['opportunities'])}")
    print(f"Initial Successes Count: {len(data['successes'])}")

    # 5. Confirm Sales Order to Trigger Shortage
    print("\n[Step 5] Triggering shortage by creating and confirming a Sales Order...")
    # Fetch products to get FG001
    prod_resp = client.get("/api/products", headers=headers)
    products = {p["sku"]: p for p in prod_resp.json()}
    fg001 = products["FG001"]

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
    
    confirm_resp = client.post(f"/api/sales-orders/{so_id}/confirm", headers=headers)
    assert confirm_resp.status_code == 200
    print("[PASS] Confirmed Sales Order. MO and PO drafted. Shortage of RM001 triggered.")

    # 6. Query /api/insights again and assert shortage is detected
    print("\n[Step 6] Querying /api/insights again to verify shortage detection...")
    resp = client.get("/api/insights", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    
    print(f"New Health Score: {data['business_health_score']}%")
    print(f"New Summary: {data['summary']}")
    print(f"New Critical Insights Count: {len(data['critical_insights'])}")
    
    # Assert RM001 shortage is in critical insights
    shortage_found = False
    for insight in data["critical_insights"]:
        if insight["category"] == "manufacturing" and "RM001" in insight["description"]:
            shortage_found = True
            print(f"[PASS] Found critical shortage insight: {insight['title']}")
            print(f"       Description: {insight['description']}")
            print(f"       Impact: {insight['impact']}")
            print(f"       Recommendation: {insight['recommendation']}")
            assert insight["severity"] == "critical"
            assert "RM001" in insight["description"]
            assert "Teak Wood Plank" in insight["description"]
            assert "Approve purchase order to procure RM001." == insight["recommendation"]
            
    assert shortage_found, "Critical shortage insight for RM001 not found!"
    print("[PASS] Shortage detection verified successfully.")

    # 7. Manufacturing critical shortage test for Chair
    print("\n[Step 7] Testing manufacturing critical shortage insight for Chair...")
    
    # Reset and seed database to clear previous Sales Order
    seed_db()
    
    # Authenticate again to get fresh token and headers
    login_response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch initial products to locate RM001
    prod_resp = client.get("/api/products", headers=headers)
    products = {p["sku"]: p for p in prod_resp.json()}
    rm001 = products["RM001"]

    # Create Finished Good product "Chair" (SKU: "FG002")
    chair_payload = {
        "sku": "FG002",
        "name": "Chair",
        "description": "Standard wooden chair",
        "category": "Finished Good",
        "sales_price": 100.0,
        "cost_price": 50.0,
        "on_hand_qty": 0.0,
        "reserved_qty": 0.0,
        "min_stock_level": 0.0,
        "is_bom_item": True,
        "procure_on_demand": True,
        "procurement_type": "manufacturing"
    }
    chair_resp = client.post("/api/products", json=chair_payload, headers=headers)
    assert chair_resp.status_code == 201
    chair = chair_resp.json()
    chair_id = chair["id"]
    print("[PASS] Created Finished Good product for Chair (SKU: FG002).")

    # Create BoM for Chair with component RM001 (Teak Wood Plank) and quantity 2.0
    bom_payload = {
        "product_id": chair_id,
        "name": "Chair BoM",
        "description": "Bill of materials for Chair",
        "components": [
            {
                "component_product_id": rm001["id"],
                "quantity": 2.0
            }
        ],
        "operations": []
    }
    bom_resp = client.post("/api/boms", json=bom_payload, headers=headers)
    assert bom_resp.status_code == 201
    bom = bom_resp.json()
    bom_id = bom["id"]
    print("[PASS] Created BoM for Chair with component RM001.")

    # Update Chair product's bom_id
    update_chair_resp = client.put(f"/api/products/{chair_id}", json={"bom_id": bom_id}, headers=headers)
    assert update_chair_resp.status_code == 200
    print("[PASS] Updated Chair product to reference the new BoM.")

    # Update RM001 (Wood Plank) on-hand quantity to 0.0
    update_rm_resp = client.put(f"/api/products/{rm001['id']}", json={"on_hand_qty": 0.0}, headers=headers)
    assert update_rm_resp.status_code == 200
    print("[PASS] Updated RM001 on-hand quantity to 0.0.")

    # Create a Sales Order for 900 Chairs
    so_payload = {
        "customer_name": "Delhi Furniture Mart",
        "lines": [
            {
                "product_id": chair_id,
                "quantity": 900.0,
                "unit_price": 100.0
            }
        ]
    }
    so_resp = client.post("/api/sales-orders", json=so_payload, headers=headers)
    assert so_resp.status_code == 201
    so_id = so_resp.json()["id"]
    print(f"[PASS] Created Draft Sales Order {so_id} for 900 Chairs.")

    # Confirm the Sales Order
    confirm_resp = client.post(f"/api/sales-orders/{so_id}/confirm", headers=headers)
    assert confirm_resp.status_code == 200
    print("[PASS] Confirmed Sales Order.")

    # Query /api/insights
    insights_resp = client.get("/api/insights", headers=headers)
    assert insights_resp.status_code == 200
    insights_data = insights_resp.json()

    # Find critical shortage insight for RM001
    shortage_found = False
    for insight in insights_data["critical_insights"]:
        if insight["category"] == "manufacturing" and "RM001" in insight["description"]:
            shortage_found = True
            print(f"[PASS] Found critical shortage insight for Chair component RM001: {insight['title']}")
            print(f"       Required: {insight.get('required')}")
            print(f"       Available: {insight.get('available')}")
            print(f"       Shortage: {insight.get('shortage')}")
            assert insight["severity"] == "critical"
            assert insight.get("required") == 1800.0
            assert insight.get("available") == 0.0
            assert insight.get("shortage") == 1800.0

    assert shortage_found, "Critical shortage insight for RM001 not found!"
    print("[PASS] Chair manufacturing shortage verified successfully.")

    print("\n==================================================")
    print("ALL INSIGHTS TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()

