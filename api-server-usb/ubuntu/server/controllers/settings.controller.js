const Settings = require("../services/settings.service");
const Backups = require("../services/backup.service");
const canManage = (user) => ["admin", "manager"].includes(user.role);
function guard(req, res) {
  if (canManage(req.user)) return false;
  res.status(403).json({
    message: "Settings management is restricted to administrators and managers",
  });
  return true;
}
function handle(res, action) {
  try {
    return action();
  } catch (error) {
    console.error("Settings error", error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Settings operation failed",
    });
  }
}
module.exports = {
  backups(req, res) {
    return handle(res, () => res.json({ backups: Backups.list(req.user) }));
  },
  async createBackup(req, res) {
    try {
      return res.status(201).json({ backup: await Backups.create(req.user) });
    } catch (error) {
      console.error("Backup error", error);
      return res.status(error.status || 500).json({ message: error.message || "Backup creation failed" });
    }
  },
  uploadBackup(req, res) {
    return handle(res, () => res.status(201).json({ backup: Backups.upload(req.body, req.headers["x-file-name"], req.user) }));
  },
  downloadBackup(req, res) {
    try {
      const backup = Backups.file(req.params.name, req.user);
      return res.download(backup.path, backup.name);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message || "Backup download failed" });
    }
  },
  deleteBackup(req, res) {
    return handle(res, () => res.json(Backups.remove(req.params.name, req.user)));
  },
  async restoreBackup(req, res) {
    try {
      const result = await Backups.restore(req.params.name, req.body?.confirmation, req.user);
      // Keep serving the current database until an intentional API restart.
      // Closing it here would break authentication for every pending request.
      return res.json(result);
    } catch (error) {
      console.error("Restore error", error);
      return res.status(error.status || 500).json({ message: error.message || "Backup restore failed" });
    }
  },
  async resetBusinessData(req, res) {
    try {
      const result = await Backups.resetBusinessData(
        req.body?.confirmation,
        req.user,
        req.token,
      );
      return res.json(result);
    } catch (error) {
      console.error("Data reset error", error);
      return res.status(error.status || 500).json({ message: error.message || "Data reset failed" });
    }
  },
  group(req, res) {
    return handle(res, () =>
      res.json({ settings: Settings.getGroup(req.params.group) }),
    );
  },
  updateGroup(req, res) {
    if (guard(req, res)) return;
    return handle(res, () =>
      res.json({
        settings: Settings.updateGroup(req.params.group, req.body, req.user),
      }),
    );
  },
  paymentMethods(req, res) {
    return handle(res, () =>
      res.json({ payment_methods: Settings.paymentMethods() }),
    );
  },
  paymentStatus(req, res) {
    if (guard(req, res)) return;
    if (typeof req.body.is_active !== "boolean")
      return res
        .status(400)
        .json({ message: "Payment method status must be boolean" });
    return handle(res, () =>
      res.json({
        payment_methods: Settings.setPaymentActive(
          req.params.code,
          req.body.is_active,
        ),
      }),
    );
  },
  printers(req, res) {
    return handle(res, () => res.json({ printers: Settings.printers() }));
  },
  savePrinter(req, res) {
    if (guard(req, res)) return;
    return handle(res, () =>
      res.json({ printers: Settings.savePrinter(req.body) }),
    );
  },
  profiles(req, res) {
    return handle(res, () => res.json({ print_profiles: Settings.profiles() }));
  },
  saveProfile(req, res) {
    if (guard(req, res)) return;
    return handle(res, () =>
      res.json({
        print_profile: Settings.saveProfile(req.params.type, req.body),
      }),
    );
  },
};
