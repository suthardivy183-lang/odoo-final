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

    print("\n==================================================")
    print("ALL INSIGHTS TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
