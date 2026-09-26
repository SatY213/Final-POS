import { useEffect, useState } from "react";
import ConnectionPanel from "../../../../components/connection/ConnectionPanel";

export default function ConnectionTab() {
  const [config, setConfig] = useState(undefined);
  useEffect(() => { window.electronAPI.getConnectionConfig().then(setConfig); }, []);
  if (config === undefined) return null;
  return <ConnectionPanel initialConfig={config} />;
}
