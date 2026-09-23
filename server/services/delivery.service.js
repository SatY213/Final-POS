const db = require("../config/database");
const Settings = require("./settings.service");
const { applyStock } = require("./pos.service");

class DeliveryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function authorize(warehouseId,user){
  if(user.role!=="admin"&&Number(user.warehouse_id)!==Number(warehouseId))throw new DeliveryError("Delivery is unauthorized",403);
}
function hydrate(id){
  const row=db.prepare(`SELECT d.*,s.sale_number,s.total,s.fulfillment_type,s.sale_status,c.name customer_name,w.name warehouse_name
    FROM deliveries d JOIN sales s ON s.id=d.sale_id JOIN warehouses w ON w.id=d.warehouse_id
    LEFT JOIN customers c ON c.id=d.customer_id WHERE d.id=?`).get(Number(id));
  if(!row)return null;
  row.lines=db.prepare(`SELECT dl.*,sl.quantity quantity_sold,
    COALESCE((SELECT SUM(dl2.quantity) FROM delivery_lines dl2 JOIN deliveries d2 ON d2.id=dl2.delivery_id WHERE dl2.sale_line_id=dl.sale_line_id AND d2.status IN ('SHIPPED','DELIVERED')),0) quantity_delivered
    FROM delivery_lines dl JOIN sale_lines sl ON sl.id=dl.sale_line_id WHERE dl.delivery_id=? ORDER BY dl.id`).all(row.id)
    .map(line=>({...line,quantity_remaining_to_deliver:Math.max(0,Number(line.quantity_sold)-Number(line.quantity_delivered))}));
  return row;
}
function detail(id,user){const row=hydrate(id);if(!row)throw new DeliveryError("Delivery not found",404);authorize(row.warehouse_id,user);return row;}
function list(query,user){
  const warehouseId=Number(query.warehouse_id||user.warehouse_id);authorize(warehouseId,user);
  const where=["d.warehouse_id=@warehouse"],params={warehouse:warehouseId};
  if(query.status){where.push("d.status=@status");params.status=String(query.status)}
  if(query.search){where.push("(s.sale_number LIKE @search COLLATE NOCASE OR c.name LIKE @search COLLATE NOCASE)");params.search=`%${String(query.search).trim()}%`}
  const items=db.prepare(`SELECT d.id,d.sale_id,d.status,d.delivery_date,d.prepared_at,d.shipped_at,d.delivered_at,s.sale_number,s.total,c.name customer_name,
    COALESCE(SUM(dl.quantity),0) quantity FROM deliveries d JOIN sales s ON s.id=d.sale_id LEFT JOIN customers c ON c.id=d.customer_id LEFT JOIN delivery_lines dl ON dl.delivery_id=d.id
    WHERE ${where.join(" AND ")} GROUP BY d.id ORDER BY d.created_at DESC,d.id DESC`).all(params);
  return {items,pagination:{page:1,limit:items.length||25,total:items.length,pages:1}};
}
const transition=db.transaction((id,target,user)=>{
  const delivery=detail(id,user);
  if(target==="SHIPPED"){
    if(delivery.status==="SHIPPED"||delivery.status==="DELIVERED")return delivery;
    if(delivery.status!=="PREPARED")throw new DeliveryError("Only a prepared delivery can be shipped",409);
    const settings={sales:Settings.getGroup("sales"),expiration:Settings.getGroup("expiration")};
    for(const line of delivery.lines){
      const saleLine=db.prepare(`SELECT sl.*,COALESCE(p.track_stock,0) track_stock,COALESCE(p.track_batches,0) track_batches,COALESCE(p.track_expiration,0) track_expiration,COALESCE(p.track_serials,0) track_serials FROM sale_lines sl LEFT JOIN products p ON p.id=sl.product_id WHERE sl.id=?`).get(line.sale_line_id);
      if (!saleLine) throw new DeliveryError("Delivery sale line is unavailable",409);
      // Prepared deliveries do not move stock yet, therefore their serial
      // selection cannot be safely treated as a completed allocation. Choose
      // the currently available serials atomically at shipment instead.
      const serialIds=saleLine.track_serials
        ? db.prepare("SELECT id FROM stock_serials WHERE product_id=? AND warehouse_id=? AND status='AVAILABLE' ORDER BY received_at,id LIMIT ?").all(saleLine.product_id,delivery.warehouse_id,Number(line.base_quantity)).map(row=>row.id)
        : [];
      applyStock({...saleLine,quantity:line.quantity,base_quantity:line.base_quantity,serial_ids:serialIds},delivery.sale_id,line.sale_line_id,delivery.warehouse_id,user,settings);
    }
    const changed=db.prepare("UPDATE deliveries SET status='SHIPPED',stock_out_at=CURRENT_TIMESTAMP,shipped_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PREPARED' AND stock_out_at IS NULL").run(delivery.id).changes;
    if(changed!==1)throw new DeliveryError("Delivery transition conflict",409);
    return hydrate(delivery.id);
  }
  if(target==="DELIVERED"){
    if(delivery.status==="DELIVERED")return delivery;
    if(delivery.status!=="SHIPPED")throw new DeliveryError("Only a shipped delivery can be delivered",409);
    db.prepare("UPDATE deliveries SET status='DELIVERED',delivered_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SHIPPED'").run(delivery.id);
    return hydrate(delivery.id);
  }
  throw new DeliveryError("Invalid delivery transition");
});
function ship(id,user){return transition(id,"SHIPPED",user)}
function deliver(id,user){return transition(id,"DELIVERED",user)}

module.exports={DeliveryError,list,detail,ship,deliver};
