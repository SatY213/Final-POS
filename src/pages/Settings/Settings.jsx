import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Database,
  FileText,
  Languages,
  Printer,
  Settings as SettingsIcon,
  ShoppingCart,
  PackagePlus,
  Users,
  Wallet,
  Warehouse,
  Server,
} from "lucide-react";

import WarehousesTab from "./tabs/warehouses/WarehousesTab";
import CashRegistersTab from "./tabs/cash-registers/CashRegistersTab";
import LanguageTab from "./tabs/language/LanguageTab";
import UsersTab from "./tabs/users/UsersTab";
import ConfigurationTabs, {
  AlertsSettings,
} from "./tabs/configuration/ConfigurationTabs";
import PrintingTab from "./tabs/printing/PrintingTab";
import GeneralTab from "./tabs/general/GeneralTab";
import BackupTab from "./tabs/backup/BackupTab";
import ConnectionTab from "./tabs/connection/ConnectionTab";
import { useLanguage } from "../../i18n/LanguageContext";

export default function Settings() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("general");

  const sections = useMemo(
    () => [
      {
        id: "organisation",
        label: t("settingsSectionOrganisation"),
        tabs: [
          {
            id: "warehouses",
            label: t("warehouses"),
            icon: Warehouse,
          },
          {
            id: "users",
            label: t("users"),
            icon: Users,
          },
        ],
      },
      {
        id: "pos",
        label: t("settingsSectionPos"),
        tabs: [
          {
            id: "sales",
            label: t("salesPosSettings"),
            icon: ShoppingCart,
          },
          {
            id: "purchases",
            label: t("purchasesSettings"),
            icon: PackagePlus,
          },
          {
            id: "payments",
            label: t("paymentsSettings"),
            icon: CreditCard,
          },
          {
            id: "invoicing",
            label: t("invoicingSettings"),
            icon: FileText,
          },
          {
            id: "cash",
            label: t("cashSettings"),
            icon: Wallet,
          },
        ],
      },
      {
        id: "inventory",
        label: t("settingsSectionInventory"),
        tabs: [
          {
            id: "alerts",
            label: t("alertsSettings"),
            icon: AlertTriangle,
          },
        ],
      },
      {
        id: "printing",
        label: t("settingsSectionPrinting"),
        tabs: [
          {
            id: "printing",
            label: t("printing"),
            icon: Printer,
          },
        ],
      },
      {
        id: "system",
        label: t("settingsSectionSystem"),
        tabs: [
          {
            id: "general",
            label: t("general"),
            icon: SettingsIcon,
          },
          {
            id: "language",
            label: t("language"),
            icon: Languages,
          },
          {
            id: "connection",
            label: t("connectionServer"),
            icon: Server,
          },
          {
            id: "backup",
            label: t("backup"),
            icon: Database,
          },
        ],
      },
    ],
    [t],
  );

  const currentTab = useMemo(
    () =>
      sections
        .flatMap((section) => section.tabs)
        .find((tab) => tab.id === activeTab),
    [sections, activeTab],
  );

  return (
    <div className="flex h-full min-h-0 bg-[#f5f7f5] text-black">
      <SettingsSidebar
        sections={sections}
        activeTab={activeTab}
        onSelect={setActiveTab}
        title={t("settings")}
        description={t("settingsDescription")}
      />

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1500px] p-5 lg:p-6">
          <div className="mb-4 flex items-end justify-between border-b border-gray-300 pb-3">
            <div>
              <h1 className="text-[18px] font-bold tracking-tight text-black">
                {currentTab?.label}
              </h1>
              <p className="mt-1 text-[11px] text-black/45">
                {getTabHint(activeTab, t)}
              </p>
            </div>
          </div>

          <SettingsContent activeTab={activeTab} t={t} />
        </div>
      </main>
    </div>
  );
}

function SettingsSidebar({
  sections,
  activeTab,
  onSelect,
  title,
  description,
}) {
  return (
    <aside className="w-[245px] shrink-0 overflow-y-auto border-r border-gray-300 bg-white">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4">
        <h1 className="text-[19px] font-bold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-[190px] text-[11px] leading-4 text-black/50">
          {description}
        </p>
      </div>

      <nav className="px-3 py-3">
        {sections.map((section, sectionIndex) => (
          <div key={section.id} className={sectionIndex === 0 ? "" : "mt-5"}>
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.09em] text-black/35">
              {section.label}
            </div>

            <div className="space-y-1">
              {section.tabs.map((tab) => (
                <SettingsNavItem
                  key={tab.id}
                  tab={tab}
                  active={activeTab === tab.id}
                  onClick={() => onSelect(tab.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function SettingsNavItem({ tab, active, onClick }) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "group flex min-h-[42px] w-full items-center gap-3 border-l-2 px-3 py-2",
        "text-left text-[12px] font-semibold transition-none",
        active
          ? "border-[#099323] bg-[#edf8ef] text-[#087c1e]"
          : "border-transparent bg-white text-black hover:bg-gray-50",
      ].join(" ")}
    >
      <Icon
        size={17}
        strokeWidth={1.9}
        className={active ? "text-[#099323]" : "text-black/65"}
      />

      <span className="min-w-0 leading-4">{tab.label}</span>
    </button>
  );
}

function SettingsContent({ activeTab, t }) {
  switch (activeTab) {
    case "warehouses":
      return <WarehousesTab />;

    case "users":
      return <UsersTab />;

    case "sales":
      return <ConfigurationTabs group="sales" />;
    case "purchases":
      return <ConfigurationTabs group="purchases" />;
    case "payments":
      return <ConfigurationTabs group="payments" />;
    case "invoicing":
      return <ConfigurationTabs group="invoicing" />;

    case "cash":
      return (
        <div className="space-y-4">
          <CashRegistersTab />
          <ConfigurationTabs group="cash" />
        </div>
      );

    case "alerts":
      return <AlertsSettings />;

    case "printing":
      return <PrintingTab />;

    case "general":
      return <GeneralTab />;

    case "language":
      return <LanguageTab />;

    case "backup":
      return <BackupTab />;
    case "connection":
      return <ConnectionTab />;

    default:
      return null;
  }
}

function getTabHint(activeTab, t) {
  const hints = {
    warehouses: t("settingsHintWarehouses"),
    users: t("settingsHintUsers"),
    sales: t("settingsHintSales"),
    purchases: t("settingsHintPurchases"),
    payments: t("settingsHintPayments"),
    cash: t("settingsHintCash"),
    alerts: t("settingsHintAlerts"),
    printing: t("settingsHintPrinting"),
    general: t("settingsHintGeneral"),
    language: t("settingsHintLanguage"),
    backup: t("settingsHintBackup"),
    connection: t("settingsHintConnection"),
  };

  return hints[activeTab] || t("settingsDescription");
}
