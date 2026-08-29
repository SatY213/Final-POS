const API_URL="http://localhost:3000";
function headers(){let token=null;try{token=JSON.parse(localStorage.getItem("pos_session"))?.token||null;}catch{token=null;}return{"Content-Type":"application/json",Authorization:`Bearer ${token}`};}
async function request(path,options={}){const response=await fetch(`${API_URL}${path}`,{...options,headers:headers()}),data=await response.json();if(!response.ok)throw new Error(data.message||"Inventory request failed");return data;}
const query=(values)=>new URLSearchParams(Object.entries(values).filter(([,value])=>value!==""&&value!==null&&value!==undefined));
export const getStock=(filters)=>request(`/api/inventory?${query(filters)}`);
export const getInventoryProducts=(warehouseId,search="")=>request(`/api/inventory/products?${query({warehouse_id:warehouseId,search})}`).then(data=>data.products);
export const getStockBatches=(warehouseId,productId)=>request(`/api/inventory/batches?${query({warehouse_id:warehouseId,product_id:productId})}`).then(data=>data.batches);
export const receiveStock=(body)=>request("/api/inventory/receive",{method:"POST",body:JSON.stringify(body)});
export const adjustStock=(body)=>request("/api/inventory/adjust",{method:"POST",body:JSON.stringify(body)});
export const transferStock=(body)=>request("/api/inventory/transfer",{method:"POST",body:JSON.stringify(body)});
export const getStockMovements=(filters)=>request(`/api/inventory/movements?${query(filters)}`);
