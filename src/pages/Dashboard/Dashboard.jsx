import {
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  ShoppingBag,
  BarChart3,
  Settings,
  AlertTriangle,
  ReceiptText,
  TrendingUp,
  Wallet,
  Search,
  ArrowRight,
} from "lucide-react";

import { useLanguage } from "../../i18n/LanguageContext";

const quickModules = [
  { key: "products", icon: Package, bg: "bg-[#eef5ff]", color: "text-[#2563eb]" },
  { key: "inventory", icon: Boxes, bg: "bg-[#fff4df]", color: "text-[#b86e00]" },
  { key: "customers", icon: Users, bg: "bg-[#eef0ff]", color: "text-[#4f46e5]" },
  { key: "suppliers", icon: Truck, bg: "bg-[#e8f5f3]", color: "text-[#0f766e]" },
  { key: "purchases", icon: ShoppingBag, bg: "bg-[#fff0e6]", color: "text-[#c45d16]" },
  { key: "reports", icon: BarChart3, bg: "bg-[#f2ecff]", color: "text-[#7c3aed]" },
  { key: "settings", icon: Settings, bg: "bg-[#eeeeee]", color: "text-black" },
  { key: "cashRegisterModule", page: "cash-register", icon: Wallet, bg: "bg-[#e8f7eb]", color: "text-[#087c1e]" },
];

export default function Dashboard({ cashSession, onNavigate }) {
  const { t } = useLanguage();

  function navigate(page) {
    if (onNavigate) {
      onNavigate(page);
    }
  }

  function handleStartSale() {
    if (cashSession) {
      navigate("sales");
      return;
    }
    navigate("cash-register");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f5f7f5] text-black">
      {/* MAIN */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1500px] px-7 py-5">
          {/* PRIMARY ACTION */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            {/* START SALE */}
            <button
              type="button"
              onClick={handleStartSale}
              className="
                flex min-h-[170px]
                items-center
                justify-between
                border border-[#087c1e]
                bg-[#099323]
                px-7
                text-left
                text-white
              "
            >
              <div className="flex items-center gap-6">
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center bg-white/15">
                  <ShoppingCart size={34} strokeWidth={1.9} />
                </div>

                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-white/75">
                    {t("newTransaction")}
                  </p>

                  <h1 className="mt-2 text-[30px] font-bold tracking-tight">
                    {t("startSale")}
                  </h1>

                  <p className="mt-2 text-sm text-white/80">
                    {t("scanCheckout")}
                  </p>
                </div>
              </div>

              <ArrowRight size={30} strokeWidth={1.7} className="shrink-0" />
            </button>

            {/* QUICK PRODUCT SEARCH */}
            <div className="flex min-h-[170px] flex-col border border-gray-300 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-[#eef5ff] text-[#2563eb]">
                  <Search size={20} strokeWidth={1.9} />
                </div>

                <div>
                  <h2 className="text-[15px] font-semibold">
                    {t("quickProductSearch")}
                  </h2>

                  <p className="mt-[2px] text-[11px] text-black/50">
                    {t("productSearchDescription")}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex h-12 border border-gray-400 bg-white">
                <input
                  type="text"
                  placeholder={t("searchProduct")}
                  className="
                    min-w-0 flex-1
                    bg-transparent
                    px-4
                    text-sm
                    text-black
                    outline-none
                    placeholder:text-black/40
                  "
                />

                <button
                  type="button"
                  onClick={() => navigate("products")}
                  className="
                    flex w-12
                    items-center
                    justify-center
                    border-l border-gray-300
                    bg-[#eef5ff]
                    text-[#2563eb]
                  "
                >
                  <Search size={19} strokeWidth={1.9} />
                </button>
              </div>
            </div>
          </section>

          {/* QUICK ACCESS */}
          <section className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">{t("quickAccess")}</h2>

              <p className="text-[11px] text-black/45">{t("openModule")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {quickModules.map((item) => {
                const Icon = item.icon;
                return <button key={item.key} type="button" onClick={() => navigate(item.page || item.key)} className="flex h-[96px] flex-col items-center justify-center border border-gray-400 bg-white px-3 text-center"><div className={`flex h-9 w-9 items-center justify-center ${item.bg} ${item.color}`}><Icon size={19} strokeWidth={1.9} /></div><span className="mt-3 text-[13px] font-semibold">{t(item.key)}</span></button>;
              })}
            </div>
          </section>

          {/* TODAY */}
          <section className="mt-5">
            <h2 className="mb-3 text-[14px] font-semibold">{t("today")}</h2>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <InfoCard
                title={t("sales")}
                value="0 DA"
                icon={TrendingUp}
                iconBg="bg-[#e8f7eb]"
                iconColor="text-[#099323]"
              />

              <InfoCard
                title={t("transactions")}
                value="0"
                icon={ReceiptText}
                iconBg="bg-[#eef5ff]"
                iconColor="text-[#2563eb]"
              />

              <InfoCard
                title={t("payments")}
                value="0 DA"
                icon={Wallet}
                iconBg="bg-[#eef0ff]"
                iconColor="text-[#4f46e5]"
              />

              <InfoCard
                title={t("lowStock")}
                value="0"
                icon={AlertTriangle}
                iconBg="bg-[#fff4df]"
                iconColor="text-[#b86e00]"
              />
            </div>
          </section>

          {/* BOTTOM */}
          <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
            {/* RECENT TRANSACTIONS */}
            <div className="border border-gray-300 bg-white">
              <div className="flex h-[52px] items-center justify-between border-b border-gray-200 px-5">
                <h2 className="text-[14px] font-semibold">
                  {t("recentTransactions")}
                </h2>

                <button
                  type="button"
                  onClick={() => navigate("sales")}
                  className="text-xs font-semibold text-[#099323]"
                >
                  {t("viewSales")}
                </button>
              </div>

              <div className="flex h-[130px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center bg-[#eeeeee]">
                    <ReceiptText
                      size={19}
                      strokeWidth={1.8}
                      className="text-black/45"
                    />
                  </div>

                  <p className="mt-3 text-[13px] font-semibold">
                    {t("noTransactions")}
                  </p>

                  <p className="mt-1 text-[11px] text-black/45">
                    {t("salesAppear")}
                  </p>
                </div>
              </div>
            </div>

            {/* ATTENTION */}
            <div className="border border-gray-300 bg-white">
              <div className="flex h-[52px] items-center justify-between border-b border-gray-200 px-5">
                <h2 className="text-[14px] font-semibold">{t("attention")}</h2>

                <span className="flex items-center gap-2 text-[11px] font-semibold text-[#099323]">
                  <span className="h-2 w-2 bg-[#099323]" />
                  {t("allGood")}
                </span>
              </div>

              <div className="flex h-[130px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center bg-[#e8f7eb]">
                    <Boxes
                      size={19}
                      strokeWidth={1.8}
                      className="text-[#099323]"
                    />
                  </div>

                  <p className="mt-3 text-[13px] font-semibold">
                    {t("stockHealthy")}
                  </p>

                  <p className="mt-1 text-[11px] text-black/45">
                    {t("noStockAlerts")}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   INFO CARD
========================================================= */

function InfoCard({ title, value, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="flex min-h-[92px] items-center justify-between border border-gray-300 bg-white px-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/45">
          {title}
        </p>

        <p className="mt-2 text-[21px] font-bold tracking-tight text-black">
          {value}
        </p>
      </div>

      <div
        className={`
          flex h-10 w-10
          items-center
          justify-center
          ${iconBg}
          ${iconColor}
        `}
      >
        <Icon size={20} strokeWidth={1.9} />
      </div>
    </div>
  );
}
