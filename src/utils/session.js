const SESSION_KEY="pos_session";
export function getStoredSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY))||null;}catch{return null;}}
export function setStoredSession(session){localStorage.setItem(SESSION_KEY,JSON.stringify(session));}
export function clearStoredSession(){localStorage.removeItem(SESSION_KEY);}
export function getAuthToken(){return getStoredSession()?.token||null;}
