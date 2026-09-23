import { useEffect, useMemo, useRef, useState } from "react";
import ErrorMessage from "../../../../components/ui/ErrorMessage";
import { inputClass } from "../../../../components/ui/FormField";
import { getCustomers } from "../../../../api/customer.model";
import {
  getPaymentMethods,
  getSettings,
  setPaymentMethodActive,
  updateSettings,
} from "../../../../api/settings.model";
import { useLanguage } from "../../../../i18n/LanguageContext";

const GROUPS = {
  sales: {
    sections: [
      {
        title: "Vente & POS",
        i18nKey: "salesSectionPos",
        fields: [
          {
            key: "default_fulfillment_type",
            type: "select",
            options: ["IMMEDIATE", "SHIPPING"],
            description: "Mode de vente proposé à l'ouverture du POS.",
          },
          {
            key: "default_print_document",
            type: "select",
            options: ["TICKET", "BON_POUR"],
            description: "Présentation d'impression proposée par défaut.",
          },
          {
            key: "default_print_format",
            type: "select",
            options: ["NONE", "A4", "A5", "THERMAL_80", "THERMAL_58"],
            description: "Format d'impression proposé par défaut.",
          },
        ],
      },
      {
        title: "Client",
        i18nKey: "salesSectionCustomer",
        fields: [
          {
            key: "default_customer_id",
            type: "customer",
            description:
              "Client automatiquement sélectionné lors d'une nouvelle vente.",
          },
          {
            key: "allow_default_customer",
            type: "boolean",
            description:
              "Permet d'effectuer une vente avec le client par défaut.",
          },
        ],
      },
      {
        title: "Prix & remises",
        i18nKey: "salesSectionPricing",
        fields: [
          {
            key: "allow_price_edit",
            type: "boolean",
            description:
              "Autorise la modification manuelle du prix au point de vente.",
          },
          {
            key: "allow_discount",
            type: "boolean",
            description: "Autorise l'application de remises pendant la vente.",
          },
          {
            key: "max_discount_percent",
            type: "number",
            min: 0,
            max: 100,
            suffix: "%",
            description: "Pourcentage maximal de remise autorisé.",
            disabledWhen: (values) => !values.allow_discount,
          },
        ],
      },
      {
        title: "Encaissement rapide",
        i18nKey: "salesSectionQuickCheckout",
        fields: [
          {
            key: "quick_checkout_enabled",
            type: "boolean",
            description:
              "Autorise Ctrl+Entrée pour finaliser un paiement exact.",
          },
          {
            key: "quick_checkout_payment_method",
            type: "payment",
            description:
              "Moyen utilisé pour l'encaissement rapide. DEFAULT suit le moyen par défaut.",
            disabledWhen: (values) => !values.quick_checkout_enabled,
          },
          {
            key: "quick_checkout_exact_amount_only",
            type: "boolean",
            description: "Limite l'encaissement rapide au montant exact.",
            disabledWhen: (values) => !values.quick_checkout_enabled,
          },
        ],
      },
      {
        title: "Panier & scanner",
        i18nKey: "salesSectionCartScanner",
        fields: [
          {
            key: "scan_add_immediately",
            type: "boolean",
            description:
              "Ajoute immédiatement le produit après lecture du code-barres.",
          },
          {
            key: "existing_product_behavior",
            type: "select",
            options: ["INCREMENT_QUANTITY", "NEW_LINE"],
            description:
              "Définit le comportement lorsqu'un produit est déjà dans le panier.",
          },
        ],
      },
      {
        title: "Stock",
        i18nKey: "salesSectionStock",
        fields: [
          {
            key: "allow_negative_stock",
            type: "boolean",
            description:
              "Autorise une vente lorsque le stock disponible est insuffisant.",
          },
        ],
      },
    ],
  },

  purchases: {
    sections: [{
      titleKey: "purchasesSettings",
      fields: [{
        key: "default_print_format",
        type: "select",
        options: ["NONE", "A4", "A5", "THERMAL_80", "THERMAL_58"],
        description: "Format proposé par défaut dans le point d’achat. Aucune impression laisse les documents enregistrés sans les imprimer.",
      }],
    }],
  },

  payments: {
    sections: [
      {
        title: "Comportement",
        fields: [
          {
            key: "default_method",
            type: "payment",
            description:
              "Moyen de paiement sélectionné automatiquement à l'encaissement.",
          },
        ],
      },
    ],
  },

  invoicing: {
    sections: [{
      titleKey: "invoicingFiscalSection",
      fields: [
        { key: "tax_enabled", type: "boolean" },
        { key: "tax_rate", type: "number", min: 0, max: 100, suffix: "%", disabledWhen: values => !values.tax_enabled },
        { key: "stamp_enabled", type: "boolean" },
        { key: "stamp_rate", type: "number", min: 0, max: 100, suffix: "%", disabledWhen: values => !values.stamp_enabled },
      ],
    }],
  },

  cash: {
    sections: [
      {
        title: "Règles de caisse",
        fields: [
          {
            key: "require_open_session_for_cash_payment",
            type: "boolean",
            description:
              "Exige une session de caisse ouverte pour les paiements en espèces.",
          },
          {
            key: "block_negative_drawer",
            type: "boolean",
            description:
              "Empêche une sortie manuelle supérieure au cash théorique disponible.",
          },
          {
            key: "require_closing_count",
            type: "boolean",
            description:
              "Exige le comptage physique de la caisse avant la clôture.",
          },
          {
            key: "require_difference_note",
            type: "select",
            options: ["NEVER", "WHEN_DIFFERENT", "ALWAYS"],
            description:
              "Définit quand une justification d'écart de caisse est requise.",
          },
        ],
      },
    ],
  },

};

export default function ConfigurationTabs({ group }) {
  const { t } = useLanguage();
  const [values, setValues] = useState({});
  const [customers, setCustomers] = useState([]);
  const [methods, setMethods] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savedValuesRef = useRef(null);
  const valuesRef = useRef({});

  const config = GROUPS[group];

  async function load() {
    try {
      setError("");

      const tasks = [getSettings(group)];

      if (group === "sales") {
        tasks.push(getCustomers({ status: "active", page: 1, limit: 100 }));
      }

      if (group === "payments") {
        tasks.push(getPaymentMethods());
      }

      const result = await Promise.all(tasks);

      setValues(result[0]);
      valuesRef.current = result[0];
      savedValuesRef.current = JSON.stringify(result[0]);

      if (group === "sales") {
        setCustomers(result[1]?.customers || []);
      }

      if (group === "payments") {
        setMethods(result[1] || []);
      }

    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [group]);

  async function save(draft = valuesRef.current) {
    try {
      setSaving(true);
      setError("");

      const { default_customer_valid: _validation, ...payload } = draft;
      const updated = await updateSettings(group, payload);
      savedValuesRef.current = JSON.stringify(updated);
      // Do not replace an edit made while an earlier autosave was in flight.
      if (JSON.stringify(valuesRef.current) === JSON.stringify(draft)) {
        valuesRef.current = updated;
        setValues(updated);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const serialised = JSON.stringify(values);
    if (!savedValuesRef.current || serialised === savedValuesRef.current) return;
    const timer = window.setTimeout(() => save(values), 650);
    return () => window.clearTimeout(timer);
  }, [values, group]);

  async function toggleMethod(method) {
    try {
      setError("");
      setMethods(await setPaymentMethodActive(method.code, !method.is_active));
    } catch (err) {
      setError(err.message);
    }
  }

  function setValue(key, value) {
    setValues((current) => {
      const next = {
      ...current,
      [key]: value,
      };
      valuesRef.current = next;
      return next;
    });
  }

  if (!config) {
    return null;
  }

  return (
    <section className="border border-gray-300 bg-white">
      <SettingsHeader
        title={t(`${group}Settings`)}
        description={t(`${group}SettingsDescription`)}
      />

      <ErrorMessage message={error} />

      {group === "sales" && values.default_customer_valid === false && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-[12px] font-medium text-amber-800">
          {t("inactiveDefaultCustomer")}
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {config.sections.map((section) => (
          <SettingsSection
            key={section.title}
            title={section.titleKey ? t(section.titleKey) : section.i18nKey ? t(section.i18nKey) : t(section.title)}
          >
            {section.fields.map((field) => (
              <SettingRow
                key={field.key}
                field={field}
                value={values[field.key]}
                values={values}
                onChange={(value) => setValue(field.key, value)}
                customers={customers}
                methods={methods}
                group={group}
                t={t}
              />
            ))}
          </SettingsSection>
        ))}

        {group === "payments" && (
          <SettingsSection title={t("paymentMethods")}>
            <PaymentMethods methods={methods} onToggle={toggleMethod} />
          </SettingsSection>
        )}

      </div>

      <AutoSaveStatus saving={saving} />
    </section>
  );
}

function SettingsHeader({ title, description }) {
  return (
    <div className="border-b border-gray-200 px-6 py-5">
      <h2 className="text-[18px] font-bold text-black">{title}</h2>
      <p className="mt-1 text-[12px] text-black/55">{description}</p>
    </div>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div>
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/55">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-gray-200">{children}</div>
    </div>
  );
}

function SettingRow({
  field,
  value,
  values,
  onChange,
  customers,
  methods,
  group,
  t,
}) {
  const label = t(`setting_${field.key}`);
  const description =
    group === "sales" || group === "invoicing"
      ? t(`settingDescription_${field.key}`)
      : t(field.description);
  const disabled =
    typeof field.disabledWhen === "function"
      ? field.disabledWhen(values)
      : false;

  if (field.type === "boolean") {
    return (
      <label
        className={`flex min-h-[60px] cursor-pointer items-center gap-3 px-6 py-3 ${
          disabled ? "opacity-50" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-[#099323]"
        />

        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-black">{label}</div>
          {description && (
            <div className="mt-0.5 text-[11px] leading-4 text-black/50">
              {description}
            </div>
          )}
        </div>
      </label>
    );
  }

  return (
    <div
      className={`grid min-h-[72px] items-center gap-4 px-6 py-3 lg:grid-cols-[minmax(280px,1fr)_minmax(260px,420px)] ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <label className="text-[12px] font-semibold text-black">{label}</label>
        {description && (
          <div className="mt-0.5 text-[11px] leading-4 text-black/50">
            {description}
          </div>
        )}
      </div>

      <SettingControl
        field={field}
        value={value}
        disabled={disabled}
        onChange={onChange}
        customers={customers}
        methods={methods}
        t={t}
      />
    </div>
  );
}

function SettingControl({
  field,
  value,
  disabled,
  onChange,
  customers,
  methods,
  t,
}) {
  const options = useMemo(() => {
    if (field.type === "customer") {
      return customers.map((item) => ({
        value: item.id,
        label: item.name,
      }));
    }

    if (field.type === "payment") {
      const paymentOptions = methods
        .filter((item) => item.is_active)
        .map((item) => ({
          value: item.code,
          label: item.name,
        }));
      return field.key === "quick_checkout_payment_method"
        ? [
            { value: "DEFAULT", label: t("defaultPaymentMethod") },
            ...paymentOptions,
          ]
        : paymentOptions;
    }

    if (field.options) {
      return field.options.map((option) =>
        typeof option === "string"
          ? { value: option, label: t(option) }
          : option,
      );
    }

    return null;
  }, [field, customers, methods, t]);

  if (options) {
    return (
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => {
          if (field.type === "customer") {
            onChange(event.target.value ? Number(event.target.value) : null);
            return;
          }

          onChange(event.target.value);
        }}
        className={`${inputClass} w-full disabled:cursor-not-allowed disabled:bg-gray-100`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type={field.type}
        min={field.min}
        max={field.max}
        disabled={disabled}
        value={value ?? ""}
        onChange={(event) => {
          if (field.type === "number") {
            onChange(
              event.target.value === "" ? "" : Number(event.target.value),
            );
            return;
          }

          onChange(event.target.value);
        }}
        className={`${inputClass} w-full disabled:cursor-not-allowed disabled:bg-gray-100`}
      />

      {field.suffix && (
        <span className="shrink-0 text-[12px] font-semibold text-black/55">
          {field.suffix}
        </span>
      )}
    </div>
  );
}

function PaymentMethods({ methods, onToggle }) {
  return (
    <div className="px-6 py-2">
      {methods.map((method, index) => {
        const locked = method.code === "CASH";

        return (
          <label
            key={method.code}
            className={`flex min-h-[52px] items-center gap-3 py-2 ${
              index !== methods.length - 1 ? "border-b border-gray-200" : ""
            } ${locked ? "cursor-default" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              checked={!!method.is_active}
              disabled={locked}
              onChange={() => onToggle(method)}
              className="h-4 w-4 shrink-0 accent-[#099323]"
            />

            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-black">
                {method.name}
              </div>
            </div>

            <span className="text-[10px] font-medium text-black/35">
              {method.code}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function AutoSaveStatus({ saving }) {
  const { t } = useLanguage();
  return (
    <div className="border-t border-gray-200 px-6 py-3 text-right text-[11px] text-black/45">
      {saving ? t("saving") : t("autoSave")}
    </div>
  );
}

export function AlertsSettings() {
  const { t } = useLanguage();
  const [stock, setStock] = useState({});
  const [expiration, setExpiration] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(null);
  const alertValuesRef = useRef({ stock: {}, expiration: {} });

  useEffect(() => {
    Promise.all([getSettings("stock"), getSettings("expiration")])
      .then(([stockSettings, expirationSettings]) => {
        setStock(stockSettings);
        setExpiration(expirationSettings);
        alertValuesRef.current = { stock: stockSettings, expiration: expirationSettings };
        savedRef.current = JSON.stringify(alertValuesRef.current);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function save(draft = alertValuesRef.current) {
    try {
      setSaving(true);
      setError("");

      const [stockSettings, expirationSettings] = await Promise.all([
        updateSettings("stock", draft.stock),
        updateSettings("expiration", draft.expiration),
      ]);

      setStock(stockSettings);
      setExpiration(expirationSettings);
      alertValuesRef.current = { stock: stockSettings, expiration: expirationSettings };
      savedRef.current = JSON.stringify(alertValuesRef.current);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const draft = { stock, expiration };
    const serialised = JSON.stringify(draft);
    if (!savedRef.current || serialised === savedRef.current) return;
    alertValuesRef.current = draft;
    const timer = window.setTimeout(() => save(draft), 650);
    return () => window.clearTimeout(timer);
  }, [stock, expiration]);

  return (
    <section className="border border-gray-300 bg-white">
      <SettingsHeader
        title={t("alertsSettings")}
        description={t("alertsSettingsDescription")}
      />

      <ErrorMessage message={error} />

      <SettingsSection title={t("Stock")}>
        <CheckboxSetting
          label={t("setting_low_stock_alert_enabled")}
          description={t("Utilise le seuil minimum défini pour chaque produit.")}
          value={stock.low_stock_alert_enabled}
          onChange={(value) =>
            setStock((current) => ({
              ...current,
              low_stock_alert_enabled: value,
            }))
          }
        />
      </SettingsSection>

      <SettingsSection title={t("Péremption")}>
        <CheckboxSetting
          label={t("setting_alert_enabled")}
          description={t("Active les alertes pour les lots arrivant à expiration.")}
          value={expiration.alert_enabled}
          onChange={(value) =>
            setExpiration((current) => ({
              ...current,
              alert_enabled: value,
            }))
          }
        />

        <CompactSettingRow
          label={t("setting_warning_days")}
          description={t("Nombre de jours avant expiration pour déclencher l'alerte.")}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="365"
              value={expiration.warning_days ?? 30}
              onChange={(event) =>
                setExpiration((current) => ({
                  ...current,
                  warning_days: Number(event.target.value),
                }))
              }
              className={`${inputClass} w-full`}
            />
            <span className="text-[12px] font-semibold text-black/55">
              {t("jours")}
            </span>
          </div>
        </CompactSettingRow>

        <CheckboxSetting
          label={t("setting_block_expired_sale")}
          description={t("Empêche la vente d'un lot dont la date d'expiration est dépassée.")}
          value={expiration.block_expired_sale}
          onChange={(value) =>
            setExpiration((current) => ({
              ...current,
              block_expired_sale: value,
            }))
          }
        />

        <CheckboxSetting
          label={t("setting_warn_near_expiration")}
          description={t("Avertit le caissier lorsqu'un lot approche de sa date d'expiration.")}
          value={expiration.warn_near_expiration}
          onChange={(value) =>
            setExpiration((current) => ({
              ...current,
              warn_near_expiration: value,
            }))
          }
        />

        <CheckboxSetting
          label={t("setting_use_fefo")}
          description={t("Priorise les lots dont la date d'expiration est la plus proche.")}
          value={expiration.use_fefo}
          onChange={(value) =>
            setExpiration((current) => ({
              ...current,
              use_fefo: value,
            }))
          }
        />
      </SettingsSection>

      <AutoSaveStatus saving={saving} />
    </section>
  );
}

function CheckboxSetting({ label, description, value, onChange, disabled }) {
  return (
    <label
      className={`flex min-h-[60px] cursor-pointer items-center gap-3 px-6 py-3 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={!!value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-[#099323]"
      />

      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-black">{label}</div>
        {description && (
          <div className="mt-0.5 text-[11px] leading-4 text-black/50">
            {description}
          </div>
        )}
      </div>
    </label>
  );
}

function CompactSettingRow({ label, description, children }) {
  return (
    <div className="grid min-h-[72px] items-center gap-4 px-6 py-3 lg:grid-cols-[minmax(280px,1fr)_minmax(260px,420px)]">
      <div>
        <div className="text-[12px] font-semibold text-black">{label}</div>
        {description && (
          <div className="mt-0.5 text-[11px] leading-4 text-black/50">
            {description}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
