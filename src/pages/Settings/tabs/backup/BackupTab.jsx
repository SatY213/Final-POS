import { useEffect, useRef, useState } from "react";
import { Database, Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { createBackup, deleteBackup, downloadBackup, getBackups, resetBusinessData, restoreBackup, uploadBackup } from "../../../../api/settings.model";
import Button from "../../../../components/ui/Button";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import ErrorMessage from "../../../../components/ui/ErrorMessage";
import { formatDateTime } from "../../../../utils/formatters";
import { useLanguage } from "../../../../i18n/LanguageContext";

const size = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
export default function BackupTab() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [action, setAction] = useState(null), [confirmation, setConfirmation] = useState("");
  const fileInput = useRef(null);
  async function load() { try { setError(""); setItems(await getBackups()); } catch (reason) { setError(reason.message); } }
  useEffect(() => { load(); }, []);
  async function run(callback) { try { setBusy(true); setError(""); await callback(); setAction(null); setConfirmation(""); await load(); } catch (reason) { setError(reason.message); } finally { setBusy(false); } }
  async function selected(event) { const file = event.target.files?.[0]; event.target.value = ""; if (file) await run(() => uploadBackup(file)); }
  async function resetData() { await run(() => resetBusinessData(confirmation)); setNotice("dataResetComplete"); window.setTimeout(() => window.location.reload(), 800); }
  return <section className="border border-gray-300 bg-white">
    <ErrorMessage message={error} onClose={() => setError("")} />
    <ErrorMessage message={notice ? t(notice) : ""} type="warning" onClose={() => setNotice("")} />
    <input ref={fileInput} hidden type="file" accept=".sqlite,.db" onChange={selected}/>
    <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4"><div className="flex h-10 w-10 items-center justify-center bg-green-50 text-green-700"><Database size={20}/></div><div><h2 className="text-[16px] font-bold">{t("backupManagement")}</h2><p className="mt-1 text-[11px] text-black/50">{t("backupManagementDescription")}</p></div><Button className="ml-auto" icon={Upload} onClick={() => fileInput.current?.click()} disabled={busy}>{t("selectBackup")}</Button><Button variant="primary" icon={Plus} onClick={() => run(createBackup)} disabled={busy}>{t("createBackup")}</Button></div>
    <div className="overflow-auto"><table className="w-full text-left text-[11px]"><thead><tr className="h-11 border-b bg-gray-50"><th className="px-4">{t("backupFile")}</th><th>{t("creationDate")}</th><th>{t("size")}</th><th>{t("status")}</th><th className="px-4 text-right">{t("actions")}</th></tr></thead><tbody>{items.map((item) => <tr key={item.name} className="h-12 border-b"><td className="px-4 font-semibold">{item.name}</td><td>{formatDateTime(item.updated_at)}</td><td>{size(item.size)}</td><td><span className={`border px-2 py-1 font-semibold ${item.valid ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"}`}>{item.valid ? t("compatible") : t("invalid")}</span></td><td className="px-4"><div className="flex justify-end gap-2"><Button className="h-8 px-2" icon={Download} onClick={() => downloadBackup(item.name)}>{t("download")}</Button><Button className="h-8 px-2" icon={RotateCcw} disabled={!item.valid} onClick={() => setAction({ type: "restore", item })}>{t("restore")}</Button><Button className="h-8 px-2" variant="danger" icon={Trash2} onClick={() => setAction({ type: "delete", item })}>{t("delete")}</Button></div></td></tr>)}{!items.length && <tr><td colSpan="5" className="p-12 text-center text-black/40">{t("noBackups")}</td></tr>}</tbody></table></div>
    <ConfirmDialog open={action?.type === "delete"} title={t("deleteBackup")} message={t("deleteBackupConfirmation")} confirmLabel={t("delete")} cancelLabel={t("cancel")} danger busy={busy} onClose={() => setAction(null)} onConfirm={() => run(() => deleteBackup(action.item.name))}/>
    <div className="border-t border-red-200 bg-red-50 p-5"><div className="flex items-center gap-4"><div className="flex-1"><h3 className="text-[14px] font-bold text-red-800">{t("deleteAllData")}</h3><p className="mt-1 text-[11px] leading-4 text-red-700">{t("deleteAllDataDescription")}</p></div><Button variant="danger" icon={Trash2} disabled={busy} onClick={() => { setConfirmation(""); setAction({ type: "reset" }); }}>{t("deleteAllData")}</Button></div></div>
    <ConfirmDialog open={action?.type === "restore"} title={t("restoreBackup")} message={t("restoreBackupConfirmation")} confirmLabel={t("restore")} cancelLabel={t("cancel")} danger busy={busy} expectedValue="RESTAURER" confirmationValue={confirmation} onConfirmationChange={setConfirmation} onClose={() => { setAction(null); setConfirmation(""); }} onConfirm={() => run(async () => { await restoreBackup(action.item.name, confirmation); setNotice("restoreScheduled"); })}/>
    <ConfirmDialog open={action?.type === "reset"} title={t("deleteAllData")} message={t("deleteAllDataConfirmation")} confirmLabel={t("deleteAllData")} cancelLabel={t("cancel")} danger busy={busy} expectedValue="SUPPRIMER" confirmationValue={confirmation} onConfirmationChange={setConfirmation} onClose={() => { setAction(null); setConfirmation(""); }} onConfirm={resetData}/>
  </section>;
}
