import FormField, { inputClass } from "../ui/FormField";
export default function LegalBusinessFields({ values, onChange, t }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {[
        ["taxId", "nif"],
        ["statisticalId", "nis"],
        ["rib", "rib"],
        ["taxArticle", "tax_article"],
        ["commercialRegister", "commercial_register"],
      ].map(([label, name]) => (
        <FormField key={name} label={t(label)}>
          <input
            name={name}
            value={values[name]}
            onChange={onChange}
            className={inputClass}
          />
        </FormField>
      ))}
    </div>
  );
}
