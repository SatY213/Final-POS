const assert=require("node:assert/strict");
require("../database/migrations/init");
const db=require("../config/database");
const CashSession=require("../models/cash-session.model");
let complete=false;
try{db.transaction(()=>{
  const account=db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get();assert.ok(account,"A seeded user is required");
  db.prepare("UPDATE cash_sessions SET status='closed',closing_cash=opening_cash,expected_cash_at_close=opening_cash,closing_difference=0,closed_at=CURRENT_TIMESTAMP WHERE status='open'").run();
  const warehouse=Number(db.prepare("INSERT INTO warehouses(name) VALUES(?)").run("Cash Test Warehouse").lastInsertRowid),register=Number(db.prepare("INSERT INTO cash_registers(warehouse_id,name,code) VALUES(?,?,?)").run(warehouse,"Cash Test Register",`CASH-${Date.now()}`).lastInsertRowid),user={id:account.id,role:"admin",warehouse_id:null};
  let session=CashSession.open(register,user.id,10000);assert.equal(session.expected_cash,10000);assert.equal(CashSession.findAvailableRegisters(user,warehouse).length,0);
  session=CashSession.createMovement(session.id,user.id,"IN",5000,"Additional change");assert.equal(session.manual_in_total,5000);assert.equal(session.expected_cash,15000);
  session=CashSession.createMovement(session.id,user.id,"OUT",2000,"Manager handover");assert.equal(session.manual_out_total,2000);assert.equal(session.expected_cash,13000);
  assert.throws(()=>CashSession.createMovement(session.id,user.id,"OUT",13000.01,"Too much"),/exceeds theoretical/);assert.equal(CashSession.listMovements(session.id).length,2);
  session=CashSession.close(session.id,user.id,12900,"Count checked");assert.equal(session.status,"closed");assert.equal(session.expected_cash_at_close,13000);assert.equal(session.closing_difference,-100);assert.equal(CashSession.list({page:1,limit:25,status:"closed"},user).cash_sessions.some(item=>item.id===session.id),true);
  assert.throws(()=>CashSession.createMovement(session.id,user.id,"IN",1,"Late"),/not open/);
  complete=true;throw new Error("ROLLBACK_TEST");
})();}catch(error){if(error.message!=="ROLLBACK_TEST")throw error;}
assert.equal(complete,true);console.log("Cash session integration test passed (transaction rolled back).");
