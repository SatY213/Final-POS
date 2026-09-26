POS MODERN - CLE USB DU SERVEUR API
==================================

Ce dossier est directement transportable. Pour le regenerer apres une mise a
jour du logiciel :

  npm run make
  npm run prepare:api-server-usb

Serveur Ubuntu : copiez le dossier ubuntu complet sur la cle USB.

Premiere installation :
  chmod +x INSTALL_API_SERVER_UBUNTU.sh
  sudo ./INSTALL_API_SERVER_UBUNTU.sh

Mise a jour :
  chmod +x UPDATE_API_SERVER_UBUNTU.sh
  ./UPDATE_API_SERVER_UBUNTU.sh

Serveur Windows : copiez le dossier windows complet puis lancez
INSTALL_API_SERVER.bat.

La base du serveur est preservee pendant les mises a jour.
