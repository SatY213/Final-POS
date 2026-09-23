import { getRuntimeSettings } from "./runtimeSettings";

// UI amounts deliberately use a stable, language-independent decimal point.
// Print templates have their own formatter and therefore retain their existing
// French document formatting.
export function formatMoney(value){const settings=getRuntimeSettings(),decimals=Number(settings.monetary_decimals??2),amount=Number(value||0).toLocaleString("en-US",{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).replace(/,/g," "),code=settings.default_currency||"DZD",symbol={DZD:"DA",EUR:"€",USD:"$"}[code]||code;if(settings.currency_display==="CODE_BEFORE")return`${code} ${amount}`;return`${amount} ${settings.currency_display==="CODE_AFTER"?code:symbol}`;}
export function formatQuantity(value,locale="en",maximumFractionDigits=3){return Number(value||0).toLocaleString(locale,{maximumFractionDigits});}
function dateParts(value){const date=new Date(`${String(value).slice(0,10)}T00:00:00`);return{day:String(date.getDate()).padStart(2,"0"),month:String(date.getMonth()+1).padStart(2,"0"),year:String(date.getFullYear())};}
export function formatDate(value){if(!value)return"-";const p=dateParts(value),format=getRuntimeSettings().date_format;return format==="YYYY-MM-DD"?`${p.year}-${p.month}-${p.day}`:format==="MM/DD/YYYY"?`${p.month}/${p.day}/${p.year}`:`${p.day}/${p.month}/${p.year}`;}
export function formatDateTime(value){if(!value)return"-";if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value))return formatDate(value);const normalized=typeof value==="string"&&!/[zZ]|[+-]\d\d:\d\d$/.test(value)?`${value.replace(" ","T")}Z`:value,date=new Date(normalized),settings=getRuntimeSettings();return`${formatDate(date.toISOString())} ${new Intl.DateTimeFormat("en",{hour:"2-digit",minute:"2-digit",hour12:settings.time_format==="12H"}).format(date)}`;}
