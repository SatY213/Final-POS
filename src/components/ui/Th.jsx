import React from "react";
export default function Th({ children, right }) {
  return (
    <th
      className={`px-4 text-[12px] font-bold first:px-5 ${right ? "text-right rtl:text-left" : ""}`}
    >
      {children}
    </th>
  );
}
