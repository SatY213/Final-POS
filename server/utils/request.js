function parsePagination(query,{defaultLimit=25,allowedLimits=[25,50,100]}={}){const requested=Number(query.limit);const limit=allowedLimits.includes(requested)?requested:defaultLimit;const page=Math.max(1,Number(query.page)||1);return{page,limit,offset:(page-1)*limit};}
function optionalText(value){return typeof value==="string"&&value.trim()?value.trim():null;}
module.exports={parsePagination,optionalText};
