from sqlalchemy.orm import Session
from backend.app.models import (
    Product, PurchaseOrder, SalesOrder, ManufacturingOrder,
    ManufacturingOrderComponent, ManufacturingOrderOperation
)
from backend.app.schemas import InsightsResponse, InsightItem

def calculate_business_health_and_insights(db: Session) -> InsightsResponse:
    # 1. Fetch data from DB
    products = db.query(Product).all()
    purchase_orders = db.query(PurchaseOrder).all()
    sales_orders = db.query(SalesOrder).all()
    manufacturing_orders = db.query(ManufacturingOrder).all()

    # 2. Inventory Health (30%)
    if not products:
        inventory_health = 100.0
    else:
        healthy_products = sum(1 for p in products if p.on_hand_qty >= p.min_stock_level)
        inventory_health = (healthy_products / len(products)) * 100.0

    # 3. Procurement Health (20%)
    # status in Ordered, Confirmed, Received, Fully Received, Partially Received
    healthy_po_statuses = {"Ordered", "Confirmed", "Received", "Fully Received", "Partially Received"}
    relevant_pos = [po for po in purchase_orders if po.status != "Cancelled"]
    if not relevant_pos:
        procurement_health = 100.0
    else:
        healthy_pos = sum(1 for po in relevant_pos if po.status in healthy_po_statuses)
        procurement_health = (healthy_pos / len(relevant_pos)) * 100.0

    # 4. Manufacturing Health (20%)
    def check_mo_shortage(mo) -> bool:
        for comp in mo.components:
            remaining = comp.required_quantity - comp.consumed_quantity
            # Check if remaining required component qty exceeds what is on hand
            if remaining > comp.component_product.on_hand_qty:
                return True
        return False

    relevant_mos = [mo for mo in manufacturing_orders if mo.status != "Cancelled"]
    if not relevant_mos:
        manufacturing_health = 100.0
    else:
        healthy_mos = sum(
            1 for mo in relevant_mos 
            if mo.status == "Completed" or not check_mo_shortage(mo)
        )
        manufacturing_health = (healthy_mos / len(relevant_mos)) * 100.0

    # 5. Sales Performance (20%)
    relevant_sos = [so for so in sales_orders if so.status != "Cancelled"]
    if not relevant_sos:
        sales_performance = 100.0
    else:
        healthy_sos = sum(1 for so in relevant_sos if so.status in {"Confirmed", "Completed"})
        sales_performance = (healthy_sos / len(relevant_sos)) * 100.0

    # 6. Operational Efficiency (10%)
    completed_ops = db.query(ManufacturingOrderOperation).filter(
        ManufacturingOrderOperation.status == "Completed"
    ).all()
    ratios = []
    for op in completed_ops:
        if op.actual_time_minutes and op.actual_time_minutes > 0:
            ratio = op.standard_time_minutes / op.actual_time_minutes
            ratios.append(ratio)

    if not ratios:
        operational_efficiency = 100.0
    else:
        operational_efficiency = (sum(ratios) / len(ratios)) * 100.0

    # 7. Aggregate overall health score
    business_health_score = (
        0.3 * inventory_health +
        0.2 * procurement_health +
        0.2 * manufacturing_health +
        0.2 * sales_performance +
        0.1 * operational_efficiency
    )
    business_health_score = round(business_health_score, 2)

    # 8. Generate Insights across 7 categories
    critical_insights = []
    warnings = []
    opportunities = []
    successes = []

    def add_insight(insight: InsightItem):
        if insight.severity == "critical":
            critical_insights.append(insight)
        elif insight.severity == "warning":
            warnings.append(insight)
        elif insight.severity == "info" and insight.category in ["sales", "procurement"]:
            opportunities.append(insight)
        elif insight.severity == "success":
            successes.append(insight)

    # Category 1 & 2: Inventory Risk & Procurement Recommendations
    for p in products:
        # Inventory Risk: Stock below minimum
        if p.on_hand_qty < p.min_stock_level:
            add_insight(InsightItem(
                severity="warning",
                category="inventory",
                title=f"Stock below minimum level for {p.name}",
                description=f"Current stock of {p.sku} ({p.on_hand_qty}) is below the minimum required level of {p.min_stock_level}.",
                impact="Risk of stockout and production halts for dependent operations.",
                recommendation=f"Procure or manufacture additional units of {p.sku} to restore safety stock.",
                confidence=90
            ))
            
            # Procurement Suggestion: check for pending draft PO
            if p.category == "Raw Material":
                has_draft_po = any(
                    any(line.product_id == p.id for line in po.lines)
                    for po in purchase_orders if po.status == "Draft"
                )
                if has_draft_po:
                    add_insight(InsightItem(
                        severity="info",
                        category="procurement",
                        title=f"Recommended purchase order confirmation for {p.name}",
                        description=f"Current inventory of {p.sku} ({p.on_hand_qty}) is below safety stock, and a draft PO exists.",
                        impact="Confirming this purchase order will restock raw materials and prevent production delays.",
                        recommendation=f"Review and confirm the pending draft purchase orders for {p.sku}.",
                        confidence=85
                    ))
                else:
                    add_insight(InsightItem(
                        severity="info",
                        category="procurement",
                        title=f"Reorder recommendation for {p.name}",
                        description=f"Inventory of {p.sku} ({p.on_hand_qty}) is below the minimum stock level ({p.min_stock_level}) with no pending purchase orders.",
                        impact="Extended low stock may result in manufacturing delays.",
                        recommendation=f"Create a new purchase order for {p.sku} with vendor {p.vendor_id or 'default vendor'}.",
                        confidence=80
                    ))

        # Inventory Risk: deficit / concentration
        if p.free_to_use_qty < 0:
            add_insight(InsightItem(
                severity="critical",
                category="inventory",
                title=f"Negative free-to-use quantity for {p.name}",
                description=f"Reserved stock ({p.reserved_qty}) exceeds on-hand stock ({p.on_hand_qty}) for {p.sku}, leading to a deficit of {abs(p.free_to_use_qty)} units.",
                impact="Inability to fulfill confirmed sales orders on time.",
                recommendation=f"Initiate urgent replenishment (manufacturing or purchase) to cover the {abs(p.free_to_use_qty)} units deficit.",
                confidence=95
            ))

    # Category 3: Manufacturing Risks
    for mo in manufacturing_orders:
        if mo.status not in ["Completed", "Cancelled"]:
            for comp in mo.components:
                remaining = comp.required_quantity - comp.consumed_quantity
                if remaining > comp.component_product.on_hand_qty:
                    # Shortage detected
                    add_insight(InsightItem(
                        severity="critical",
                        category="manufacturing",
                        title=f"Material shortage for manufacturing order #{mo.id}",
                        description=f"Shortage of raw material {comp.component_product.sku} {comp.component_product.name}.",
                        impact="Production delay on key finished goods, impacting delivery commitments.",
                        recommendation=f"Approve purchase order to procure {comp.component_product.sku}.",
                        confidence=95
                    ))

    # Category 4: Sales Trends
    if sales_orders:
        product_sales = {}
        for so in sales_orders:
            if so.status != "Cancelled":
                for line in so.lines:
                    product_sales[line.product.name] = product_sales.get(line.product.name, 0.0) + line.quantity
        if product_sales:
            top_product = max(product_sales, key=product_sales.get)
            top_qty = product_sales[top_product]
            add_insight(InsightItem(
                severity="success",
                category="sales",
                title=f"Top-selling product identified: {top_product}",
                description=f"{top_product} is the highest performing product with total demand of {top_qty} units.",
                impact="Indicates strong market demand and product preference.",
                recommendation="Ensure production capacities and raw material stocks are optimized for this product line.",
                confidence=95
            ))
        
        confirmed_sos = [so for so in sales_orders if so.status == "Confirmed"]
        if confirmed_sos:
            add_insight(InsightItem(
                severity="info",
                category="sales",
                title=f"{len(confirmed_sos)} confirmed sales order(s) awaiting fulfillment",
                description=f"There are {len(confirmed_sos)} sales order(s) currently confirmed but not yet delivered.",
                impact="Fulfillment of these orders will unlock pending revenue.",
                recommendation="Prioritize associated manufacturing orders and logistics planning.",
                confidence=90
            ))
        
        completed_sos = [so for so in sales_orders if so.status == "Completed"]
        if completed_sos:
            add_insight(InsightItem(
                severity="success",
                category="sales",
                title=f"{len(completed_sos)} sales order(s) fulfilled successfully",
                description=f"Successfully delivered {len(completed_sos)} sales order(s) in this period.",
                impact="Strengthens customer relationships and realizes sales revenue.",
                recommendation="Continue maintaining prompt delivery schedules and high product quality.",
                confidence=100
            ))

    # Category 5: Operational Efficiency
    if ratios:
        avg_ratio = sum(ratios) / len(ratios)
        if avg_ratio >= 1.0:
            add_insight(InsightItem(
                severity="success",
                category="manufacturing",
                title="High manufacturing operational efficiency",
                description=f"Completed manufacturing operations ran at {avg_ratio*100:.1f}% efficiency compared to standard times.",
                impact="Optimizes resource utilization and reduces overall production lead time.",
                recommendation="Maintain current high standards and identify areas for further improvements.",
                confidence=90
            ))
        else:
            add_insight(InsightItem(
                severity="warning",
                category="manufacturing",
                title="Low manufacturing operational efficiency",
                description=f"Completed manufacturing operations ran at {avg_ratio*100:.1f}% efficiency compared to standard times.",
                impact="Increases production cost and delays fulfillment timelines.",
                recommendation="Investigate bottleneck operations and resource availability.",
                confidence=85
            ))

    # Category 6: Business Health
    if business_health_score >= 80:
        add_insight(InsightItem(
            severity="success",
            category="finance",
            title="Strong overall business health",
            description=f"The business health score is {business_health_score:.1f}%, indicating overall stability and efficient operations.",
            impact="Positive trajectory with low operational risks.",
            recommendation="Maintain current inventory and production alignment.",
            confidence=95
        ))
    else:
        add_insight(InsightItem(
            severity="warning",
            category="finance",
            title="Sub-optimal business health score",
            description=f"The business health score is {business_health_score:.1f}%, reflecting active shortages or pending fulfillments.",
            impact="Potential delivery delays and raw material constraints.",
            recommendation="Resolve critical material shortages and process pending orders.",
            confidence=95
        ))

    # General Summary string
    summary_parts = []
    if business_health_score >= 80:
        summary_parts.append(f"Overall business health is excellent (Score: {business_health_score:.1f}%).")
    elif business_health_score >= 60:
        summary_parts.append(f"Overall business health is moderate (Score: {business_health_score:.1f}%).")
    else:
        summary_parts.append(f"Overall business health is low (Score: {business_health_score:.1f}%). Action is required to resolve issues.")

    criticals_count = len(critical_insights)
    warnings_count = len(warnings)
    if criticals_count > 0:
        summary_parts.append(f"Detected {criticals_count} critical issues regarding material shortages or inventory deficits.")
    if warnings_count > 0:
        summary_parts.append(f"There are {warnings_count} active warnings, primarily due to stock levels dropping below target minimum levels.")
    if criticals_count == 0 and warnings_count == 0:
        summary_parts.append("Inventory levels and production orders are well-aligned with demand.")

    summary_text = " ".join(summary_parts)

    # Category 7: Financial Indicators
    inventory_valuation = sum(p.on_hand_qty * p.cost_price for p in products)
    pending_cost = sum(po.total_amount for po in purchase_orders if po.status in ["Draft", "Ordered", "Confirmed", "Partially Received"])
    sales_revenue = sum(so.total_amount for so in sales_orders if so.status in ["Confirmed", "Completed"])

    add_insight(InsightItem(
        severity="success",
        category="finance",
        title="Financial performance and assets summary",
        description=f"Current inventory valuation is ${inventory_valuation:.2f}. Confirmed/completed sales revenue is ${sales_revenue:.2f}, while pending procurement cost stands at ${pending_cost:.2f}.",
        impact="Provides visibility into the cash flow requirements and asset liquidity of the business.",
        recommendation="Maintain the current sales velocity while managing the procurement pipeline to optimize working capital.",
        confidence=95
    ))

    return InsightsResponse(
        business_health_score=business_health_score,
        summary=summary_text,
        critical_insights=critical_insights,
        warnings=warnings,
        opportunities=opportunities,
        successes=successes
    )
