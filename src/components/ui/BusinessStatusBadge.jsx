import { useLanguage } from "../../i18n/LanguageContext";

const statusConfig = {
  UNPAID: ["Non payé", "border-red-200 bg-red-50 text-red-800"],
  PARTIALLY_PAID: ["Partiel", "border-amber-200 bg-amber-50 text-amber-800"],
  PAID: ["Payé", "border-green-200 bg-green-50 text-green-800"],
  NOT_REQUIRED: ["—", "border-gray-200 bg-gray-50 text-gray-500"],
  PENDING: ["À livrer", "border-orange-200 bg-orange-50 text-orange-800"],
  PREPARED: ["Préparée", "border-orange-200 bg-orange-50 text-orange-800"],
  SHIPPED: ["Expédiée", "border-blue-200 bg-blue-50 text-blue-800"],
  PARTIALLY_DELIVERED: [
    "Livraison partielle",
    "border-amber-200 bg-amber-50 text-amber-800",
  ],
  DELIVERED: ["Livré", "border-green-200 bg-green-50 text-green-800"],
  COMPLETED: ["Terminée", "border-green-200 bg-green-50 text-green-800"],
  CANCELLED: ["Annulée", "border-red-200 bg-red-50 text-red-800"],
  DRAFT: ["Brouillon", "border-gray-300 bg-gray-100 text-gray-700"],
  VALIDATED: ["Validée", "border-green-200 bg-green-50 text-green-800"],
  NOT_RETURNED: ["Aucun retour", "border-gray-200 bg-gray-50 text-gray-600"],
  PARTIALLY_RETURNED: [
    "Retour partiel",
    "border-amber-200 bg-amber-50 text-amber-800",
  ],
  RETURNED: ["Retournée", "border-purple-200 bg-purple-50 text-purple-800"],
  FULLY_RETURNED: [
    "Retournée",
    "border-purple-200 bg-purple-50 text-purple-800",
  ],
  NOT_RECEIVED: ["Non reçu", "border-gray-200 bg-gray-50 text-gray-600"],
  PARTIALLY_RECEIVED: [
    "Réception partielle",
    "border-amber-200 bg-amber-50 text-amber-800",
  ],
  RECEIVED: ["Reçu", "border-green-200 bg-green-50 text-green-800"],
  ACTIVE: ["Active", "border-green-200 bg-green-50 text-green-800"],
  EXPIRED: ["Expirée", "border-red-200 bg-red-50 text-red-800"],
};

export default function BusinessStatusBadge({ value }) {
  const { t } = useLanguage();
  if (!value) return <span className="text-gray-400">—</span>;
  const [label, className] = statusConfig[value] || [
    value,
    "border-gray-300 bg-gray-50 text-gray-700",
  ];
  return (
    <span
      className={`inline-flex h-[26px] max-w-full items-center whitespace-nowrap border px-2 text-[11px] font-semibold ${className}`}
    >
      {t(label)}
    </span>
  );
}
