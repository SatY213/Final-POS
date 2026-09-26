const Inventory=require("../services/inventory.service");
const allowedTypes=new Set(["INITIAL_STOCK","RECEIPT","ADJUSTMENT_IN","ADJUSTMENT_OUT","TRANSFER_IN","TRANSFER_OUT","PURCHASE","SALE","CUSTOMER_RETURN","SUPPLIER_RETURN","DAMAGE","EXPIRED"]);
function handle(res,action){try{return action();}catch(error){console.error("Inventory error:",error);return res.status(error.status||500).json({message:error.status?error.message:"Inventory operation failed"});}}
function paging(query){return{page:Math.max(1,Number(query.page)||1),limit:[25,50,100].includes(Number(query.limit))?Number(query.limit):25};}
module.exports={
  list(req,res){return handle(res,()=>{const warehouseId=Number(req.query.warehouse_id);if(!Number.isInteger(warehouseId))throw new Inventory.InventoryError("A valid warehouse is required");const status=["all","low","out","expired","expiring"].includes(req.query.status)?req.query.status:"all";return res.json(Inventory.listStock({...paging(req.query),warehouseId,status,search:String(req.query.search||"").trim()},req.user));});},
  products(req,res){return handle(res,()=>res.json({products:Inventory.listProducts(req.query.search,req.user,Number(req.query.warehouse_id))}));},
  batches(req,res){return handle(res,()=>res.json({batches:Inventory.listBatches(req.query.product_id,Number(req.query.warehouse_id),req.user)}));},
  receive(req,res){return handle(res,()=>res.status(201).json({result:Inventory.receiveStock(req.body,req.user)}));},
  adjust(req,res){return handle(res,()=>res.status(201).json({result:Inventory.adjustStock(req.body,req.user)}));},
  transfer(req,res){return handle(res,()=>res.status(201).json({result:Inventory.transferStock(req.body,req.user)}));},
  movements(req,res){return handle(res,()=>{const type=allowedTypes.has(req.query.type)?req.query.type:null;return res.json(Inventory.listMovements({...paging(req.query),warehouseId:Number(req.query.warehouse_id),productId:Number(req.query.product_id)||null,type,from:req.query.from||null,to:req.query.to||null},req.user));});},
};
