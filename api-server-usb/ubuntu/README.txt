Copiez tout ce dossier ubuntu sur la cle USB.

Premiere installation :
  chmod +x INSTALL_API_SERVER_UBUNTU.sh
  sudo ./INSTALL_API_SERVER_UBUNTU.sh

Mise a jour :
  chmod +x UPDATE_API_SERVER_UBUNTU.sh
  ./UPDATE_API_SERVER_UBUNTU.sh

Le dossier server doit rester a cote des deux scripts.


// verify
sudo systemctl is-enabled pos-modern-api
sudo systemctl status pos-modern-api

// useful commands
sudo systemctl restart pos-modern-api
sudo systemctl stop pos-modern-api
sudo systemctl start pos-modern-api
sudo journalctl -u pos-modern-api -f