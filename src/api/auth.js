import{apiPost,apiRequest}from"./client";
export const login=(username,password)=>apiPost("/api/auth/login",{username,password},{auth:false});
export const logout=token=>apiRequest("/api/auth/logout",{method:"POST",auth:false,headers:{Authorization:`Bearer ${token}`}});
