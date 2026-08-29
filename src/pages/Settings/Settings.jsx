import { useState } from "react";
import {
  Warehouse,
  Users,
  Building2,
  ShoppingCart,
  Printer,
  Database,
  Settings as SettingsIcon,
  Monitor,
  Languages,
} from "lucide-react";
import WarehousesTab from "./tabs/warehouses/WarehousesTab";
import CashRegistersTab from "./tabs/cash-registers/CashRegistersTab";
import LanguageTab from "./tabs/language/LanguageTab";
import UsersTab from "./tabs/users/UsersTab";
import { useLanguage } from "../../i18n/LanguageContext";

export default function Settings({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("warehouses");
  const { t } = useLanguage();
  const tabs = [
    { id: "warehouses", label: t("warehouses"), icon: Warehouse },
    { id: "cash-registers", label: t("cashRegisters"), icon: Monitor },
    { id: "users", label: t("users"), icon: Users },
    { id: "company", label: t("company"), icon: Building2 },
    { id: "pos", label: t("posSales"), icon: ShoppingCart },
    { id: "printing", label: t("printing"), icon: Printer },
    { id: "backup", label: t("backup"), icon: Database },
    { id: "general", label: t("general"), icon: SettingsIcon },
    { id: "language", label: t("language"), icon: Languages },
  ];

  return (
    <div className="flex h-full flex-col bg-[#f5f7f5] text-black">
      {/* PAGE HEADER */}
      <div className="flex items-center border-b border-gray-200 bg-white px-7 py-5">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">{t("settings")}</h1>

          <p className="mt-1 text-[13px] text-black/55">
            {t("settingsDescription")}
          </p>
        </div>

      </div>

      {/* SETTINGS BODY */}
      <div className="flex min-h-0 flex-1">
        {/* TABS */}
        <aside className="w-[230px] shrink-0 border-r border-gray-300 bg-white p-3">
          <div className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex h-[46px] w-full
                    items-center gap-3
                    border px-3
                    text-left text-[13px]
                    font-semibold
                    ${
                      isActive
                        ? "border-[#099323] bg-[#e8f7eb] text-[#087c1e]"
                        : "border-gray-300 bg-white text-black"
                    }
                  `}
                >
                  <Icon size={18} strokeWidth={1.9} />

                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* TAB CONTENT */}
        <main className="min-w-0 flex-1 overflow-auto p-6">
          {activeTab === "warehouses" && <WarehousesTab />}
          {activeTab === "cash-registers" && <CashRegistersTab />}
          {activeTab === "language" && <LanguageTab />}
          {activeTab === "users" && <UsersTab />}

          {activeTab === "company" && (
            <ComingSoon
              title={t("company")}
              description={t("companyDescription")}
              message={t("comingSoon")}
            />
          )}

          {activeTab === "pos" && (
            <ComingSoon
              title={t("posSales")}
              description={t("posDescription")}
              message={t("comingSoon")}
            />
          )}

          {activeTab === "printing" && (
            <ComingSoon
              title={t("printing")}
              description={t("printingDescription")}
              message={t("comingSoon")}
            />
          )}

          {activeTab === "backup" && (
            <ComingSoon
              title={t("backup")}
              description={t("backupDescription")}
              message={t("comingSoon")}
            />
          )}

          {activeTab === "general" && (
            <ComingSoon
              title={t("general")}
              description={t("generalDescription")}
              message={t("comingSoon")}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ComingSoon({ title, description, message }) {
  return (
    <div className="border border-gray-300 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-[17px] font-bold">{title}</h2>

        <p className="mt-1 text-[12px] text-black/55">{description}</p>
      </div>

      <div className="flex min-h-[220px] items-center justify-center">
        <p className="text-[13px] font-medium text-black/45">
          {message}
        </p>
      </div>
    </div>
  );
}
