const translations = {
  en: {
    "Customer balance entry already exists for this sale":
      "A customer balance entry already exists for this sale.",
    "Sélectionnez un fournisseur et ajoutez des produits":
      "Select a supplier and add products.",
    "Saisissez au moins une quantité à retourner":
      "Enter at least one quantity to return.",
    "Créez le retour depuis le détail d'une vente.":
      "Create the return from the sale details.",
    "Veuillez sélectionner un client pour cette vente.":
      "Select a customer for this sale.",
    "Le solde client disponible est insuffisant.":
      "The available customer balance is insufficient.",
    "Unit is used by one or more products":
      "Delete the related product packaging before deleting this unit.",
    "The customer cannot be changed while this sale has account entries":
      "The customer cannot be changed while this sale has account entries.",
    "A customer is required to keep the balance of an edited sale":
      "Select a customer to preserve the balance of this edited sale.",
    "Delivery sale line is unavailable":
      "A delivery line is no longer available.",
  },
  fr: {
    "Customer balance entry already exists for this sale":
      "Une écriture de solde client existe déjà pour cette vente.",
    "Product deletion requires manager access":
      "La suppression d’un produit nécessite un accès responsable.",
    "Category deletion requires manager access":
      "La suppression d’une catégorie nécessite un accès responsable.",
    "Unit deletion requires manager access":
      "La suppression d’une unité nécessite un accès responsable.",
    "The built-in generic unit cannot be deleted":
      "L’unité générique intégrée ne peut pas être supprimée.",
    "Unit is used by one or more products":
      "Supprimez les conditionnements associés avant de supprimer cette unité.",
    "Failed to delete product": "Impossible de supprimer le produit.",
    "Failed to delete category": "Impossible de supprimer la catégorie.",
    "Failed to delete unit": "Impossible de supprimer l’unité.",
    "Failed to fetch":
      "Impossible de joindre le serveur. Vérifiez qu’il est démarré.",
    "NetworkError when attempting to fetch resource.":
      "Impossible de joindre le serveur. Vérifiez qu’il est démarré.",
    "Warehouse not found": "Entrepôt introuvable.",
    "Warehouse unavailable": "Entrepôt indisponible.",
    "Warehouse is unavailable": "Entrepôt indisponible.",
    "Warehouse unauthorized":
      "Vous n’êtes pas autorisé à accéder à cet entrepôt.",
    "Warehouse is unauthorized":
      "Vous n’êtes pas autorisé à accéder à cet entrepôt.",
    "You cannot access sales from this warehouse":
      "Vous ne pouvez pas consulter les ventes de cet entrepôt.",
    "You cannot sell from another warehouse":
      "Vous ne pouvez pas vendre depuis un autre entrepôt.",
    "The selected warehouse cannot make sales":
      "L’entrepôt sélectionné n’est pas autorisé à effectuer des ventes.",
    "A valid warehouse is required": "Sélectionnez un entrepôt valide.",
    "Purchase management requires manager access":
      "La gestion des achats nécessite un accès responsable.",
    "Stock users cannot finalize sales":
      "Un utilisateur de stock ne peut pas finaliser une vente.",
    "Active supplier required": "Sélectionnez un fournisseur actif.",
    "A valid active customer is required":
      "Sélectionnez un client actif valide.",
    "The selected customer is inactive": "Le client sélectionné est inactif.",
    "Add at least one product": "Ajoutez au moins un produit.",
    "Add at least one item to the sale":
      "Ajoutez au moins un article à la vente.",
    "Add a payment method": "Ajoutez un moyen de paiement.",
    "Invalid miscellaneous purchase line":
      "La ligne d’achat libre est invalide.",
    "Product packaging unavailable":
      "Le conditionnement du produit est indisponible.",
    "Invalid quantity, price or discount":
      "La quantité, le prix ou la remise est invalide.",
    "Purchase stock was already received":
      "Le stock de cet achat a déjà été réceptionné.",
    "Purchase order not found": "Bon de commande introuvable.",
    "Order not found": "Bon de commande introuvable.",
    "Purchase not found": "Achat introuvable.",
    "Purchase order belongs to another warehouse":
      "Ce bon de commande appartient à un autre entrepôt.",
    "Purchase order supplier cannot be changed":
      "Le fournisseur du bon de commande ne peut pas être modifié.",
    "Purchase order cannot be converted":
      "Ce bon de commande ne peut pas être converti.",
    "A received purchase is required":
      "L’achat doit être réceptionné avant de créer un retour.",
    "Return at least one quantity":
      "Saisissez au moins une quantité à retourner.",
    "Add at least one return quantity":
      "Saisissez au moins une quantité à retourner.",
    "Invalid purchase line": "La ligne d’achat est invalide.",
    "Return exceeds received quantity":
      "La quantité retournée dépasse la quantité réceptionnée.",
    "Sale not found": "Vente introuvable.",
    "Sale is unauthorized": "Vous n’êtes pas autorisé à accéder à cette vente.",
    "Sale date is invalid": "La date de vente est invalide.",
    "Backdating sales is not allowed for this user":
      "Cet utilisateur ne peut pas antidater une vente.",
    "Sale editing is not allowed for this user":
      "Cet utilisateur ne peut pas modifier une vente.",
    "A cancelled sale cannot be edited":
      "Une vente annulée ne peut pas être modifiée.",
    "Only a confirmed sale can be edited":
      "Seule une vente confirmée peut être modifiée.",
    "The customer cannot be changed while this sale has account entries":
      "Le client ne peut pas être modifié tant que cette vente possède des écritures de compte.",
    "A customer is required to keep the balance of an edited sale":
      "Sélectionnez un client afin de conserver le solde de cette vente modifiée.",
    "Quote not found": "Devis introuvable.",
    "Only a draft quote can be edited":
      "Seul un devis brouillon peut être modifié.",
    "Quote status transition is invalid":
      "Le changement de statut du devis est invalide.",
    "Delivery not found": "Livraison introuvable.",
    "Delivery is unauthorized":
      "Vous n’êtes pas autorisé à accéder à cette livraison.",
    "Only a prepared delivery can be shipped":
      "Seule une livraison préparée peut être expédiée.",
    "Only a shipped delivery can be delivered":
      "Seule une livraison expédiée peut être livrée.",
    "Delivery sale line is unavailable":
      "Une ligne de la livraison n’est plus disponible.",
    "Insufficient stock": "Stock insuffisant.",
    "This product does not track stock": "Ce produit n’est pas suivi en stock.",
    "Product is inactive or unavailable":
      "Le produit est inactif ou indisponible.",
    "Packaging is invalid or inactive":
      "Le conditionnement est invalide ou inactif.",
    "Batch or lot number is required": "Le numéro de lot est obligatoire.",
    "A valid expiration date is required":
      "Une date d’expiration valide est obligatoire.",
    "Duplicate serial numbers are not allowed":
      "Les numéros de série en double ne sont pas autorisés.",
    "A serial number already exists": "Un numéro de série existe déjà.",
    "Payment method not found": "Moyen de paiement introuvable.",
    "Payment method is unavailable": "Le moyen de paiement est indisponible.",
    "A payment method is unavailable": "Un moyen de paiement est indisponible.",
    "Printer details are invalid":
      "Les informations de l’imprimante sont invalides.",
    "Paper format is invalid": "Le format de papier est invalide.",
    "Document type is invalid": "Le type de document est invalide.",
  },
  ar: {
    "Customer balance entry already exists for this sale":
      "يوجد بالفعل قيد رصيد عميل لهذه العملية.",
    "Sélectionnez un fournisseur et ajoutez des produits":
      "اختر موردًا وأضف المنتجات.",
    "Saisissez au moins une quantité à retourner":
      "أدخل كمية واحدة على الأقل للإرجاع.",
    "Créez le retour depuis le détail d'une vente.":
      "أنشئ المرتجع من تفاصيل عملية البيع.",
    "Veuillez sélectionner un client pour cette vente.":
      "يرجى اختيار عميل لهذه العملية.",
    "Le solde client disponible est insuffisant.":
      "رصيد العميل المتاح غير كافٍ.",
    "Product deletion requires manager access":
      "حذف المنتج يتطلب صلاحية المسؤول.",
    "Category deletion requires manager access":
      "حذف الفئة يتطلب صلاحية المسؤول.",
    "Unit deletion requires manager access": "حذف الوحدة يتطلب صلاحية المسؤول.",
    "The built-in generic unit cannot be deleted":
      "لا يمكن حذف الوحدة العامة المدمجة.",
    "Unit is used by one or more products":
      "احذف وحدات تغليف المنتجات المرتبطة قبل حذف هذه الوحدة.",
    "Failed to delete product": "تعذر حذف المنتج.",
    "Failed to delete category": "تعذر حذف الفئة.",
    "Failed to delete unit": "تعذر حذف الوحدة.",
    "Failed to fetch": "تعذر الاتصال بالخادم. تأكد من تشغيله.",
    "NetworkError when attempting to fetch resource.":
      "تعذر الاتصال بالخادم. تأكد من تشغيله.",
    "Warehouse not found": "المخزن غير موجود.",
    "Warehouse unavailable": "المخزن غير متاح.",
    "Warehouse is unavailable": "المخزن غير متاح.",
    "Warehouse unauthorized": "غير مصرح لك بالدخول إلى هذا المخزن.",
    "Warehouse is unauthorized": "غير مصرح لك بالدخول إلى هذا المخزن.",
    "Purchase management requires manager access":
      "إدارة المشتريات تتطلب صلاحية المسؤول.",
    "Active supplier required": "يرجى اختيار مورد نشط.",
    "A valid active customer is required": "يرجى اختيار عميل نشط وصالح.",
    "The selected customer is inactive": "العميل المحدد غير نشط.",
    "Add at least one product": "أضف منتجًا واحدًا على الأقل.",
    "Add at least one item to the sale":
      "أضف عنصرًا واحدًا على الأقل إلى البيع.",
    "Add a payment method": "أضف طريقة دفع.",
    "Invalid quantity, price or discount": "الكمية أو السعر أو الخصم غير صالح.",
    "Purchase stock was already received": "تم استلام مخزون هذا الشراء مسبقًا.",
    "Purchase order not found": "أمر الشراء غير موجود.",
    "Order not found": "أمر الشراء غير موجود.",
    "Purchase not found": "عملية الشراء غير موجودة.",
    "Sale not found": "عملية البيع غير موجودة.",
    "Sale is unauthorized": "غير مصرح لك بالدخول إلى هذه العملية.",
    "Sale date is invalid": "تاريخ البيع غير صالح.",
    "A cancelled sale cannot be edited": "لا يمكن تعديل عملية بيع ملغاة.",
    "Quote not found": "عرض السعر غير موجود.",
    "Only a draft quote can be edited": "يمكن تعديل مسودة عرض السعر فقط.",
    "Delivery not found": "عملية التسليم غير موجودة.",
    "Delivery is unauthorized": "غير مصرح لك بالدخول إلى هذه العملية.",
    "Insufficient stock": "المخزون غير كافٍ.",
    "Product is inactive or unavailable": "المنتج غير نشط أو غير متاح.",
    "Batch or lot number is required": "رقم الدفعة إلزامي.",
    "Duplicate serial numbers are not allowed":
      "لا يسمح بتكرار الأرقام التسلسلية.",
    "Payment method not found": "طريقة الدفع غير موجودة.",
    "Payment method is unavailable": "طريقة الدفع غير متاحة.",
    "A payment method is unavailable": "طريقة الدفع غير متاحة.",
    "Printer details are invalid": "معلومات الطابعة غير صالحة.",
  },
};

Object.assign(translations.fr, {
  "Product designation is required":
    "La désignation du produit est obligatoire.",
  "Category is invalid": "La catégorie sélectionnée est invalide.",
  "Category must exist and be active":
    "La catégorie doit exister et être active.",
  "Product reference already exists": "Cette référence produit existe déjà.",
  "Batch, expiration and serial tracking require stock tracking":
    "Le suivi des lots, des expirations et des numéros de série nécessite le suivi du stock.",
  "Expiration tracking requires batch tracking":
    "Le suivi des expirations nécessite le suivi des lots.",
  "Serial and batch tracking cannot be combined":
    "Le suivi par numéro de série et le suivi par lot ne peuvent pas être combinés.",
  "Stock tracking cannot be disabled while stock records exist":
    "Le suivi du stock ne peut pas être désactivé tant que des stocks existent.",
  "Batch tracking cannot be disabled while batch records exist":
    "Le suivi des lots ne peut pas être désactivé tant que des lots existent.",
  "At least one product unit is required":
    "Au moins une unité de produit est obligatoire.",
  "Each package requires a valid unit, conversion factor and prices":
    "Chaque conditionnement nécessite une unité, un facteur de conversion et des prix valides.",
  "Product units must exist and be active":
    "Les unités du produit doivent exister et être actives.",
  "Only one primary barcode is allowed per package":
    "Un seul code-barres principal est autorisé par conditionnement.",
  "Exactly one base unit with conversion factor 1 is required":
    "Une seule unité de base avec un facteur de conversion égal à 1 est obligatoire.",
  "A unit can only be used once per product":
    "Une unité ne peut être utilisée qu’une seule fois par produit.",
  "Duplicate barcodes are not allowed":
    "Les codes-barres en double ne sont pas autorisés.",
  "Base unit cannot change while stock records exist":
    "L’unité de base ne peut pas être modifiée tant que des stocks existent.",
  "Initial stock warehouse is inactive or unauthorized":
    "L’entrepôt du stock initial est inactif ou non autorisé.",
  "Initial stock package is invalid":
    "Le conditionnement du stock initial est invalide.",
  "A warehouse can only appear once in initial stock":
    "Un entrepôt ne peut apparaître qu’une seule fois dans le stock initial.",
  "Each serialized stock unit requires one unique serial number":
    "Chaque unité sérialisée nécessite un numéro de série unique.",
  "A valid expiration date is required for each initial batch":
    "Une date d’expiration valide est obligatoire pour chaque lot initial.",
  "Serial numbers must be unique across all warehouses":
    "Les numéros de série doivent être uniques dans tous les entrepôts.",
  "Product reference, unit or barcode already exists":
    "La référence, l’unité ou le code-barres du produit existe déjà.",
  "Failed to save product": "Impossible d’enregistrer le produit.",
  "Failed to load product": "Impossible de charger le produit.",
  "Failed to load products": "Impossible de charger les produits.",
  "Product not found": "Produit introuvable.",
});

Object.assign(translations.ar, {
  "The customer cannot be changed while this sale has account entries":
    "لا يمكن تغيير العميل طالما أن هذه العملية تحتوي على قيود في حساب العميل.",
  "A customer is required to keep the balance of an edited sale":
    "يرجى اختيار عميل للحفاظ على رصيد عملية البيع المعدلة.",
  "Delivery sale line is unavailable": "أحد أسطر التسليم لم يعد متاحًا.",
  "Product designation is required": "تسمية المنتج مطلوبة.",
  "Category is invalid": "الفئة المحددة غير صالحة.",
  "Category must exist and be active": "يجب أن تكون الفئة موجودة ونشطة.",
  "Product reference already exists": "مرجع المنتج موجود مسبقًا.",
  "Batch, expiration and serial tracking require stock tracking":
    "تتبع الدفعات والصلاحية والأرقام التسلسلية يتطلب تفعيل تتبع المخزون.",
  "Expiration tracking requires batch tracking":
    "تتبع تاريخ الصلاحية يتطلب تتبع الدفعات.",
  "Serial and batch tracking cannot be combined":
    "لا يمكن الجمع بين تتبع الأرقام التسلسلية وتتبع الدفعات.",
  "Stock tracking cannot be disabled while stock records exist":
    "لا يمكن تعطيل تتبع المخزون مع وجود سجلات مخزون.",
  "Batch tracking cannot be disabled while batch records exist":
    "لا يمكن تعطيل تتبع الدفعات مع وجود دفعات.",
  "At least one product unit is required":
    "يجب إضافة وحدة واحدة للمنتج على الأقل.",
  "Each package requires a valid unit, conversion factor and prices":
    "كل تعبئة تتطلب وحدة ومعامل تحويل وأسعارًا صالحة.",
  "Product units must exist and be active":
    "يجب أن تكون وحدات المنتج موجودة ونشطة.",
  "Only one primary barcode is allowed per package":
    "يسمح بباركود رئيسي واحد فقط لكل تعبئة.",
  "Exactly one base unit with conversion factor 1 is required":
    "يجب تحديد وحدة أساسية واحدة بمعامل تحويل يساوي 1.",
  "A unit can only be used once per product":
    "يمكن استخدام الوحدة مرة واحدة فقط لكل منتج.",
  "Duplicate barcodes are not allowed": "لا يسمح بتكرار الباركود.",
  "Base unit cannot change while stock records exist":
    "لا يمكن تغيير الوحدة الأساسية مع وجود سجلات مخزون.",
  "Initial stock warehouse is inactive or unauthorized":
    "مخزن الرصيد الافتتاحي غير نشط أو غير مصرح به.",
  "Initial stock package is invalid": "تعبئة الرصيد الافتتاحي غير صالحة.",
  "A warehouse can only appear once in initial stock":
    "يمكن إدراج المخزن مرة واحدة فقط في الرصيد الافتتاحي.",
  "Each serialized stock unit requires one unique serial number":
    "كل وحدة متسلسلة تتطلب رقمًا تسلسليًا فريدًا.",
  "A valid expiration date is required for each initial batch":
    "تاريخ صلاحية صالح مطلوب لكل دفعة افتتاحية.",
  "Serial numbers must be unique across all warehouses":
    "يجب أن تكون الأرقام التسلسلية فريدة في جميع المخازن.",
  "Product reference, unit or barcode already exists":
    "مرجع المنتج أو الوحدة أو الباركود موجود مسبقًا.",
  "Failed to save product": "تعذر حفظ المنتج.",
  "Failed to load product": "تعذر تحميل المنتج.",
  "Failed to load products": "تعذر تحميل المنتجات.",
  "Product not found": "المنتج غير موجود.",
});

const purchaseErrors = {
  en: {
    "Sélectionnez un fournisseur et ajoutez des produits":
      "Select a supplier and add products.",
    "Saisissez au moins une quantité à retourner":
      "Enter at least one quantity to return.",
    "Purchase operation failed": "The purchase operation failed.",
    "Select a supplier": "Select a supplier.",
    "Invoice number is required": "The invoice number is required.",
    "Invoice number already exists": "This invoice number already exists.",
    "Invoice not found": "Invoice not found.",
  },
  fr: {
    "Warehouse unavailable": "Entrepôt indisponible.",
    "Warehouse unauthorized":
      "Vous n’êtes pas autorisé à accéder à cet entrepôt.",
    "Purchase management requires manager access":
      "La gestion des achats nécessite un accès responsable.",
    "Active supplier required": "Sélectionnez un fournisseur actif.",
    "Add at least one product": "Ajoutez au moins un produit.",
    "Invalid miscellaneous purchase line":
      "La ligne d’achat libre est invalide.",
    "Product packaging unavailable":
      "Le conditionnement du produit est indisponible.",
    "Invalid quantity, price or discount":
      "La quantité, le prix ou la remise est invalide.",
    "Purchase stock was already received":
      "Le stock de cet achat a déjà été réceptionné.",
    "Purchase order not found": "Bon de commande introuvable.",
    "Order not found": "Bon de commande introuvable.",
    "Purchase not found": "Achat introuvable.",
    "Product not found": "Produit introuvable.",
    "Purchase order belongs to another warehouse":
      "Ce bon de commande appartient à un autre entrepôt.",
    "Purchase order supplier cannot be changed":
      "Le fournisseur du bon de commande ne peut pas être modifié.",
    "Purchase order cannot be converted":
      "Ce bon de commande ne peut pas être converti.",
    "Purchase warehouse cannot be changed":
      "L’entrepôt de l’achat ne peut pas être modifié.",
    "A purchase order already converted to a purchase cannot be deleted":
      "Un bon de commande déjà converti en achat ne peut pas être supprimé.",
    "Payment request already used":
      "Cette demande de paiement a déjà été utilisée.",
    "Invalid payment amount": "Le montant du paiement est invalide.",
    "Return request already used":
      "Cette demande de retour a déjà été utilisée.",
    "A received purchase is required":
      "L’achat doit être réceptionné avant de créer un retour.",
    "Return at least one quantity":
      "Saisissez au moins une quantité à retourner.",
    "Invalid purchase line": "La ligne d’achat est invalide.",
    "Return exceeds received quantity":
      "La quantité retournée dépasse la quantité réceptionnée.",
    "A serial number already exists": "Un numéro de série existe déjà.",
    "Purchase operation failed": "L’opération d’achat a échoué.",
    "Select a supplier": "Sélectionnez un fournisseur.",
    "Receipt line is unavailable": "La ligne de réception est indisponible.",
    "All receipts must belong to the selected supplier and warehouse":
      "Toutes les réceptions doivent appartenir au fournisseur et à l’entrepôt sélectionnés.",
    "Invoice quantity exceeds the remaining received quantity":
      "La quantité facturée dépasse la quantité reçue restant à facturer.",
    "Invoice number is required": "Le numéro de facture est obligatoire.",
    "Invoice number already exists": "Ce numéro de facture existe déjà.",
    "Invoice not found": "Facture introuvable.",
  },
  ar: {
    "Warehouse unavailable": "المخزن غير متاح.",
    "Warehouse unauthorized": "غير مصرح لك بالدخول إلى هذا المخزن.",
    "Purchase management requires manager access":
      "إدارة المشتريات تتطلب صلاحية المسؤول.",
    "Active supplier required": "اختر موردًا نشطًا.",
    "Add at least one product": "أضف منتجًا واحدًا على الأقل.",
    "Invalid miscellaneous purchase line": "بند الشراء الحر غير صالح.",
    "Product packaging unavailable": "تعبئة المنتج غير متاحة.",
    "Invalid quantity, price or discount": "الكمية أو السعر أو الخصم غير صالح.",
    "Purchase stock was already received": "تم استلام مخزون هذا الشراء مسبقًا.",
    "Purchase order not found": "أمر الشراء غير موجود.",
    "Order not found": "أمر الشراء غير موجود.",
    "Purchase not found": "عملية الشراء غير موجودة.",
    "Product not found": "المنتج غير موجود.",
    "Purchase order belongs to another warehouse":
      "أمر الشراء هذا تابع لمخزن آخر.",
    "Purchase order supplier cannot be changed":
      "لا يمكن تغيير مورد أمر الشراء.",
    "Purchase order cannot be converted": "لا يمكن تحويل أمر الشراء هذا.",
    "Purchase warehouse cannot be changed": "لا يمكن تغيير مخزن عملية الشراء.",
    "A purchase order already converted to a purchase cannot be deleted":
      "لا يمكن حذف أمر شراء تم تحويله إلى عملية شراء.",
    "Payment request already used": "تم استخدام طلب الدفع هذا مسبقًا.",
    "Invalid payment amount": "مبلغ الدفع غير صالح.",
    "Return request already used": "تم استخدام طلب الإرجاع هذا مسبقًا.",
    "A received purchase is required": "يجب استلام الشراء قبل إنشاء مرتجع.",
    "Return at least one quantity": "أدخل كمية واحدة على الأقل للإرجاع.",
    "Invalid purchase line": "بند الشراء غير صالح.",
    "Return exceeds received quantity": "كمية الإرجاع تتجاوز الكمية المستلمة.",
    "A serial number already exists": "يوجد رقم تسلسلي مسجل مسبقًا.",
    "Purchase operation failed": "فشلت عملية الشراء.",
    "Select a supplier": "اختر موردًا.",
    "Receipt line is unavailable": "سطر الاستلام غير متاح.",
    "All receipts must belong to the selected supplier and warehouse":
      "يجب أن تنتمي جميع سندات الاستلام إلى المورد والمخزن المحددين.",
    "Invoice quantity exceeds the remaining received quantity":
      "الكمية المفوترة تتجاوز الكمية المستلمة المتبقية للفوترة.",
    "Invoice number is required": "رقم الفاتورة مطلوب.",
    "Invoice number already exists": "رقم الفاتورة هذا موجود مسبقًا.",
    "Invoice not found": "الفاتورة غير موجودة.",
  },
};
Object.entries(purchaseErrors).forEach(([language, messages]) =>
  Object.assign(translations[language], messages),
);

Object.assign(translations.en, {
  "All items from this sale have already been returned":
    "All items from this sale have already been returned.",
  "No item from this receipt is currently available in stock for return":
    "No item from this receipt is currently available in stock for return.",
  "All items from this receipt have already been returned":
    "All items from this receipt have already been returned.",
  "This receipt can no longer be edited":
    "This receipt can no longer be edited.",
  "A receipt line with a validated supplier return cannot be removed":
    "This line cannot be removed because a supplier return has already been recorded for it.",
  "Customer cannot be permanently deleted because it is used by existing documents or account entries":
    "This customer cannot be permanently deleted because it is used by existing documents or account entries.",
  "Failed to delete customer": "Unable to delete the customer.",
  "Supplier cannot be permanently deleted because it is used by existing documents or account entries":
    "This supplier cannot be permanently deleted because it is used by existing documents or account entries.",
  "Failed to delete supplier": "Unable to delete the supplier.",
  "Failed to load suppliers": "Unable to load suppliers.",
});
Object.assign(translations.fr, {
  "All items from this sale have already been returned":
    "Tous les articles de cette vente ont déjà été retournés.",
  "No item from this receipt is currently available in stock for return":
    "Aucun article de ce bon de réception n’est actuellement disponible en stock pour un retour.",
  "All items from this receipt have already been returned":
    "Tous les articles de ce bon de réception ont déjà été retournés.",
  "This receipt can no longer be edited":
    "Ce bon de réception ne peut plus être modifié.",
  "A receipt line with a validated supplier return cannot be removed":
    "Cette ligne ne peut pas être supprimée, car un retour fournisseur a déjà été enregistré.",
  "Customer cannot be permanently deleted because it is used by existing documents or account entries":
    "Ce client ne peut pas être supprimé définitivement car il est utilisé par des documents ou écritures existants.",
  "Failed to delete customer": "Impossible de supprimer le client.",
  "Supplier cannot be permanently deleted because it is used by existing documents or account entries":
    "Ce fournisseur ne peut pas être supprimé définitivement car il est utilisé par des documents ou écritures existants.",
  "Failed to delete supplier": "Impossible de supprimer le fournisseur.",
  "Failed to load suppliers": "Impossible de charger les fournisseurs.",
});
Object.assign(translations.ar, {
  "All items from this sale have already been returned":
    "تم إرجاع جميع أصناف هذه المبيعة مسبقًا.",
  "No item from this receipt is currently available in stock for return":
    "لا يوجد حاليًا أي صنف من سند الاستلام هذا متاح في المخزون للإرجاع.",
  "All items from this receipt have already been returned":
    "تم إرجاع جميع أصناف سند الاستلام هذا مسبقًا.",
  "This receipt can no longer be edited":
    "لم يعد من الممكن تعديل سند الاستلام هذا.",
  "A receipt line with a validated supplier return cannot be removed":
    "لا يمكن حذف هذا السطر لأن مرتجع مورد سُجّل عليه مسبقًا.",
  "Customer cannot be permanently deleted because it is used by existing documents or account entries":
    "لا يمكن حذف هذا العميل نهائيًا لأنه مستخدم في مستندات أو قيود حسابية موجودة.",
  "Failed to delete customer": "تعذر حذف العميل.",
  "Supplier cannot be permanently deleted because it is used by existing documents or account entries":
    "لا يمكن حذف هذا المورد نهائيًا لأنه مستخدم في مستندات أو قيود حسابية موجودة.",
  "Failed to delete supplier": "تعذر حذف المورد.",
  "Failed to load suppliers": "تعذر تحميل الموردين.",
});

const salesInvoiceErrors = {
  en: {
    "Sélectionnez au moins une vente et un article.":
      "Select at least one sale and one item.",
    "Toutes les ventes d'une facture doivent appartenir au même client.":
      "All sales on an invoice must belong to the same customer.",
    "Invoice is unauthorized": "You are not authorized to access this invoice.",
    "Warehouse is required": "A warehouse is required.",
    "Invoice line values are invalid":
      "One or more invoice line values are invalid.",
    "Select at least one sale to invoice":
      "Select at least one sale to invoice.",
    "A selected sale is unavailable": "A selected sale is unavailable.",
    "All invoiced sales must have the same customer and warehouse":
      "All invoiced sales must have the same customer and warehouse.",
    "An invoice line does not belong to the selected sales":
      "An invoice line does not belong to the selected sales.",
    "Invoice must contain at least one line":
      "The invoice must contain at least one line.",
    "Global discount is invalid": "The global discount is invalid.",
    "Tax rate is invalid": "The tax rate is invalid.",
    "Fiscal stamp rate is invalid": "The fiscal stamp rate is invalid.",
    "Payment exceeds the remaining balance":
      "The payment exceeds the remaining balance.",
    "Payment request identifier is required":
      "The payment request identifier is required.",
    "Payment method is unavailable": "The payment method is unavailable.",
    "An open cash session is required for cash payment":
      "An open cash session is required for a cash payment.",
    "Only a manager can edit an invoice": "Only a manager can edit an invoice.",
    "Only an issued invoice can be edited":
      "Only an issued invoice can be edited.",
    "Customer is unavailable": "The customer is unavailable.",
    "Invoice must remain linked to at least one sale":
      "The invoice must remain linked to at least one sale.",
    "A linked sale cannot be removed from an issued invoice":
      "A linked sale cannot be removed from an issued invoice.",
    "All linked sales must have the same customer":
      "All linked sales must have the same customer.",
    "A selected sale is already invoiced":
      "A selected sale is already invoiced.",
    "An invoice line does not belong to a linked sale":
      "An invoice line does not belong to a linked sale.",
    "Invoice total cannot be lower than its recorded payments":
      "The invoice total cannot be lower than its recorded payments.",
  },
  fr: {
    "Sélectionnez au moins une vente et un article.":
      "Sélectionnez au moins une vente et un article.",
    "Toutes les ventes d'une facture doivent appartenir au même client.":
      "Toutes les ventes d’une facture doivent appartenir au même client.",
    "Invoice is unauthorized":
      "Vous n’êtes pas autorisé à accéder à cette facture.",
    "Warehouse is required": "Un entrepôt est obligatoire.",
    "Invoice line values are invalid":
      "Les valeurs d’une ou plusieurs lignes de facture sont invalides.",
    "Select at least one sale to invoice":
      "Sélectionnez au moins une vente à facturer.",
    "A selected sale is unavailable":
      "Une vente sélectionnée n’est plus disponible.",
    "All invoiced sales must have the same customer and warehouse":
      "Toutes les ventes facturées doivent avoir le même client et le même entrepôt.",
    "An invoice line does not belong to the selected sales":
      "Une ligne de facture n’appartient pas aux ventes sélectionnées.",
    "Invoice must contain at least one line":
      "La facture doit contenir au moins une ligne.",
    "Global discount is invalid": "La remise globale est invalide.",
    "Tax rate is invalid": "Le taux de TVA est invalide.",
    "Fiscal stamp rate is invalid": "Le taux du timbre fiscal est invalide.",
    "Payment exceeds the remaining balance":
      "Le paiement dépasse le reste à payer.",
    "Payment request identifier is required":
      "L’identifiant de la demande de paiement est obligatoire.",
    "Payment method is unavailable": "Le mode de paiement est indisponible.",
    "An open cash session is required for cash payment":
      "Une session de caisse ouverte est requise pour un paiement en espèces.",
    "Only a manager can edit an invoice":
      "Seul un responsable peut modifier une facture.",
    "Only an issued invoice can be edited":
      "Seule une facture validée peut être modifiée.",
    "Customer is unavailable": "Le client est indisponible.",
    "Invoice must remain linked to at least one sale":
      "La facture doit rester liée à au moins une vente.",
    "A linked sale cannot be removed from an issued invoice":
      "Une vente liée ne peut pas être retirée d’une facture validée.",
    "All linked sales must have the same customer":
      "Toutes les ventes liées doivent avoir le même client.",
    "A selected sale is already invoiced":
      "Une vente sélectionnée est déjà facturée.",
    "An invoice line does not belong to a linked sale":
      "Une ligne de facture n’appartient pas à une vente liée.",
    "Invoice total cannot be lower than its recorded payments":
      "Le total de la facture ne peut pas être inférieur aux paiements enregistrés.",
  },
  ar: {
    "Sélectionnez au moins une vente et un article.":
      "اختر عملية بيع واحدة ومقالًا واحدًا على الأقل.",
    "Toutes les ventes d'une facture doivent appartenir au même client.":
      "يجب أن تنتمي جميع مبيعات الفاتورة إلى العميل نفسه.",
    "Invoice is unauthorized": "غير مصرح لك بالوصول إلى هذه الفاتورة.",
    "Warehouse is required": "المخزن مطلوب.",
    "Invoice line values are invalid": "قيم سطر فاتورة واحد أو أكثر غير صالحة.",
    "Select at least one sale to invoice":
      "اختر عملية بيع واحدة على الأقل للفوترة.",
    "A selected sale is unavailable": "إحدى المبيعات المحددة لم تعد متاحة.",
    "All invoiced sales must have the same customer and warehouse":
      "يجب أن تكون جميع المبيعات المفوترة للعميل والمخزن نفسيهما.",
    "An invoice line does not belong to the selected sales":
      "سطر الفاتورة لا ينتمي إلى المبيعات المحددة.",
    "Invoice must contain at least one line":
      "يجب أن تحتوي الفاتورة على سطر واحد على الأقل.",
    "Global discount is invalid": "الخصم الإجمالي غير صالح.",
    "Tax rate is invalid": "معدل الضريبة غير صالح.",
    "Fiscal stamp rate is invalid": "معدل الطابع الضريبي غير صالح.",
    "Payment exceeds the remaining balance": "الدفعة تتجاوز الرصيد المتبقي.",
    "Payment request identifier is required": "معرّف طلب الدفع مطلوب.",
    "Payment method is unavailable": "طريقة الدفع غير متاحة.",
    "An open cash session is required for cash payment":
      "يلزم فتح جلسة صندوق للدفع النقدي.",
    "Only a manager can edit an invoice": "المسؤول فقط يمكنه تعديل الفاتورة.",
    "Only an issued invoice can be edited": "يمكن تعديل الفاتورة المعتمدة فقط.",
    "Customer is unavailable": "العميل غير متاح.",
    "Invoice must remain linked to at least one sale":
      "يجب أن تبقى الفاتورة مرتبطة بعملية بيع واحدة على الأقل.",
    "A linked sale cannot be removed from an issued invoice":
      "لا يمكن إزالة عملية بيع مرتبطة من فاتورة معتمدة.",
    "All linked sales must have the same customer":
      "يجب أن تنتمي جميع المبيعات المرتبطة إلى العميل نفسه.",
    "A selected sale is already invoiced":
      "إحدى المبيعات المحددة مفوترة بالفعل.",
    "An invoice line does not belong to a linked sale":
      "سطر الفاتورة لا ينتمي إلى عملية بيع مرتبطة.",
    "Invoice total cannot be lower than its recorded payments":
      "لا يمكن أن يكون إجمالي الفاتورة أقل من المدفوعات المسجلة.",
  },
};
Object.entries(salesInvoiceErrors).forEach(([language, messages]) =>
  Object.assign(translations[language], messages),
);

Object.assign(translations.en, {
  "Refund exceeds the customer's available credit":
    "The refund exceeds the customer's available credit.",
  "Refund amount is invalid": "The refund amount is invalid.",
  "A cash payment method is required for a cash refund":
    "A cash payment method is required for a cash refund.",
  "An open cash session is required for cash refund":
    "An open cash session is required for a cash refund.",
});
Object.assign(translations.fr, {
  "Refund exceeds the customer's available credit":
    "Le remboursement dépasse le crédit client disponible.",
  "Refund amount is invalid": "Le montant du remboursement est invalide.",
  "A cash payment method is required for a cash refund":
    "Un moyen de paiement espèces est obligatoire pour un remboursement espèces.",
  "An open cash session is required for cash refund":
    "Une session de caisse ouverte est obligatoire pour un remboursement espèces.",
  "An open cash session is required for cash payment":
    "Une session de caisse ouverte est obligatoire pour un paiement espèces.",
});
Object.assign(translations.ar, {
  "Refund exceeds the customer's available credit":
    "يتجاوز المبلغ المسترد رصيد العميل المتاح.",
  "Refund amount is invalid": "مبلغ الاسترداد غير صالح.",
  "A cash payment method is required for a cash refund":
    "يلزم اختيار وسيلة دفع نقدية للاسترداد النقدي.",
  "An open cash session is required for cash refund":
    "يلزم فتح جلسة صندوق للاسترداد النقدي.",
  "An open cash session is required for cash payment":
    "يلزم فتح جلسة صندوق للدفع النقدي.",
});

Object.assign(translations.en, {
  "Supplier name is required": "The supplier name is required.",
  "Received quantity exceeds remaining ordered quantity":
    "The received quantity exceeds the remaining ordered quantity.",
  "Purchase receipt not found": "Purchase receipt not found.",
  "This receipt is cancelled": "This receipt is cancelled.",
  "Supplier return not found": "Supplier return not found.",
  "A valid purchase receipt is required":
    "A created purchase receipt is required.",
  "Payment request identifier is already used":
    "This payment request was already used.",
  "Supplier refund exceeds the available credit":
    "The supplier refund exceeds the available credit.",
  "A returned receipt line cannot be removed":
    "A returned receipt line cannot be removed.",
});
Object.assign(translations.fr, {
  "Supplier name is required": "Le nom du fournisseur est obligatoire.",
  "Received quantity exceeds remaining ordered quantity":
    "La quantité reçue dépasse la quantité commandée restante.",
  "Purchase receipt not found": "Bon de réception introuvable.",
  "This receipt is cancelled": "Ce bon de réception est annulé.",
  "Invoiced quantity exceeds remaining received quantity":
    "La quantité facturée dépasse la quantité reçue restant à facturer.",
  "Supplier return not found": "Retour fournisseur introuvable.",
  "A valid purchase receipt is required":
    "Un bon de réception créé est obligatoire.",
  "Payment request identifier is already used":
    "Cette demande de paiement a déjà été utilisée.",
  "Supplier refund exceeds the available credit":
    "Le remboursement fournisseur dépasse le crédit disponible.",
  "A returned receipt line cannot be removed":
    "Une ligne déjà retournée ne peut pas être supprimée.",
});
Object.assign(translations.ar, {
  "Supplier name is required": "اسم المورد مطلوب.",
  "Received quantity exceeds remaining ordered quantity":
    "الكمية المستلمة تتجاوز الكمية المتبقية من الطلب.",
  "Purchase receipt not found": "سند الاستلام غير موجود.",
  "This receipt is cancelled": "سند الاستلام هذا ملغى.",
  "Invoiced quantity exceeds remaining received quantity":
    "الكمية المفوترة تتجاوز الكمية المستلمة المتبقية للفوترة.",
  "Supplier return not found": "مرتجع المورد غير موجود.",
  "A valid purchase receipt is required": "يجب إنشاء سند استلام أولاً.",
  "Payment request identifier is already used": "استُخدم طلب الدفع هذا من قبل.",
  "Supplier refund exceeds the available credit":
    "استرداد المورد يتجاوز الرصيد المتاح.",
  "A returned receipt line cannot be removed": "لا يمكن حذف سطر تم إرجاعه.",
});

Object.assign(translations.en, {
  "This receipt can no longer be edited":
    "This receipt can no longer be edited.",
  "Purchase edit request identifier is required":
    "The purchase edit request identifier is required.",
  "The supplier cannot be changed after validation":
    "The supplier cannot be changed after the receipt is created.",
  "A purchase line is invalid": "A receipt line is invalid.",
  "A received line cannot change product or packaging":
    "A received line cannot change product or packaging.",
  "All receipts must belong to the selected supplier and warehouse":
    "All receipts must belong to the selected supplier and warehouse.",
  "The CSV file is empty": "The CSV file is empty.",
  "Unsupported import type": "This import type is not supported.",
  "Import is restricted to administrators and managers":
    "Import is restricted to administrators and managers.",
  "Duplicate policy is invalid": "The duplicate policy is invalid.",
  "Backup management is restricted to administrators":
    "Backup management is restricted to administrators.",
  "Backup database integrity check failed":
    "The backup integrity check failed.",
  "The selected file is not a compatible MODERN POS backup":
    "The selected file is not a compatible MODERN POS backup.",
  "The selected backup cannot be opened":
    "The selected backup cannot be opened.",
  "Backup not found": "Backup not found.",
  "Backup file is empty or invalid": "The backup file is empty or invalid.",
  "Type RESTAURER to confirm this destructive operation":
    "Type RESTAURER to confirm this destructive operation.",
});
Object.assign(translations.fr, {
  "This receipt can no longer be edited":
    "Ce bon de réception ne peut plus être modifié.",
  "Purchase edit request identifier is required":
    "L’identifiant de la modification d’achat est obligatoire.",
  "The supplier cannot be changed after validation":
    "Le fournisseur ne peut plus être modifié après la création du bon de réception.",
  "A purchase line is invalid": "Une ligne de réception est invalide.",
  "A received line cannot change product or packaging":
    "Une ligne reçue ne peut pas changer de produit ou de conditionnement.",
  "All receipts must belong to the selected supplier and warehouse":
    "Toutes les réceptions doivent appartenir au fournisseur et à l’entrepôt sélectionnés.",
  "The CSV file is empty": "Le fichier CSV est vide.",
  "Unsupported import type": "Ce type d’import n’est pas pris en charge.",
  "Import is restricted to administrators and managers":
    "L’import est réservé aux administrateurs et responsables.",
  "Duplicate policy is invalid":
    "La règle de gestion des doublons est invalide.",
  "Backup management is restricted to administrators":
    "La gestion des sauvegardes est réservée aux administrateurs.",
  "Backup database integrity check failed":
    "Le contrôle d’intégrité de la sauvegarde a échoué.",
  "The selected file is not a compatible MODERN POS backup":
    "Le fichier sélectionné n’est pas une sauvegarde MODERN POS compatible.",
  "The selected backup cannot be opened":
    "La sauvegarde sélectionnée ne peut pas être ouverte.",
  "Backup not found": "Sauvegarde introuvable.",
  "Backup file is empty or invalid":
    "Le fichier de sauvegarde est vide ou invalide.",
  "Type RESTAURER to confirm this destructive operation":
    "Saisissez RESTAURER pour confirmer cette opération destructive.",
});
Object.assign(translations.ar, {
  "This receipt can no longer be edited":
    "لا يمكن تعديل سند الاستلام هذا بعد الآن.",
  "Purchase edit request identifier is required":
    "معرّف طلب تعديل الشراء مطلوب.",
  "The supplier cannot be changed after validation":
    "لا يمكن تغيير المورد بعد إنشاء سند الاستلام.",
  "A purchase line is invalid": "أحد أسطر الاستلام غير صالح.",
  "A received line cannot change product or packaging":
    "لا يمكن تغيير المنتج أو التعبئة في سطر تم استلامه.",
  "All receipts must belong to the selected supplier and warehouse":
    "يجب أن تنتمي كل الاستلامات إلى المورد والمخزن المحددين.",
  "The CSV file is empty": "ملف CSV فارغ.",
  "Unsupported import type": "نوع الاستيراد هذا غير مدعوم.",
  "Import is restricted to administrators and managers":
    "الاستيراد متاح للمسؤولين والمديرين فقط.",
  "Duplicate policy is invalid": "سياسة التكرار غير صالحة.",
  "Backup management is restricted to administrators":
    "إدارة النسخ الاحتياطية متاحة للمسؤولين فقط.",
  "Backup database integrity check failed":
    "فشل التحقق من سلامة النسخة الاحتياطية.",
  "The selected file is not a compatible MODERN POS backup":
    "الملف المحدد ليس نسخة احتياطية متوافقة مع MODERN POS.",
  "The selected backup cannot be opened":
    "لا يمكن فتح النسخة الاحتياطية المحددة.",
  "Backup not found": "النسخة الاحتياطية غير موجودة.",
  "Backup file is empty or invalid": "ملف النسخة الاحتياطية فارغ أو غير صالح.",
  "Type RESTAURER to confirm this destructive operation":
    "اكتب RESTAURER لتأكيد هذه العملية المدمرة.",
});

// Messages returned directly by legacy controllers and cash-session models.
Object.assign(translations.fr, {
  "Start date must precede end date":
    "La date de début doit précéder la date de fin.",
  "Backup file name is invalid":
    "Le nom du fichier de sauvegarde est invalide.",
  "A backup scheduled for restoration cannot be deleted":
    "La sauvegarde programmée pour restauration ne peut pas être supprimée.",
  "Close other application instances before restoring this backup":
    "Fermez les autres instances de l’application avant de restaurer cette sauvegarde.",
  "This commercial action is not allowed for your role":
    "Votre rôle ne permet pas cette opération commerciale.",
  "Quote request identifier is required":
    "L’identifiant de la demande de devis est obligatoire.",
  "Quote date is invalid": "La date du devis est invalide.",
  "This sale does not require delivery":
    "Cette vente ne nécessite pas de livraison.",
  "Delivery requires a customer":
    "Un client est obligatoire pour la livraison.",
  "Add at least one delivery quantity":
    "Indiquez au moins une quantité à livrer.",
  "Delivery quantity exceeds the remaining quantity":
    "La quantité à livrer dépasse la quantité restante.",
  "Delivery note not found": "Bon de livraison introuvable.",
  "Only a draft delivery can be validated":
    "Seul un bon de livraison brouillon peut être validé.",
  "Only a draft delivery can be cancelled":
    "Seul un bon de livraison brouillon peut être annulé.",
  "A delivered BL is immutable; use a controlled return/correction document":
    "Un bon de livraison livré ne peut pas être modifié ; utilisez un document de retour ou de correction.",
  "Add at least one invoice quantity":
    "Indiquez au moins une quantité à facturer.",
  "Invoice quantity exceeds the invoiceable quantity":
    "La quantité à facturer dépasse la quantité facturable.",
  "Return quantity exceeds the physically fulfilled quantity":
    "La quantité retournée dépasse la quantité effectivement livrée.",
  "Serial return conflict": "Conflit sur les numéros de série du retour.",
  "Return not found": "Retour introuvable.",
  "Unsupported export type": "Ce type d’exportation n’est pas pris en charge.",
  "Delivery transition conflict":
    "Conflit lors du changement de statut de livraison.",
  "Invalid delivery transition":
    "Ce changement de statut de livraison est invalide.",
  "Warehouse is inactive or unavailable":
    "L’entrepôt est inactif ou indisponible.",
  "Converted quantity is invalid": "La quantité convertie est invalide.",
  "Purchase price must be zero or greater":
    "Le prix d’achat doit être positif ou nul.",
  "Serialized quantity must be a whole number":
    "La quantité d’un produit sérialisé doit être entière.",
  "Each stock unit requires one serial number":
    "Chaque unité en stock nécessite un numéro de série.",
  "Select one available serial number for each returned unit":
    "Sélectionnez un numéro de série disponible pour chaque unité retournée.",
  "Not enough available serial numbers":
    "Il n’y a pas assez de numéros de série disponibles.",
  "Serial allocation conflict": "Conflit d’attribution des numéros de série.",
  "Adjustment direction is invalid": "Le sens de l’ajustement est invalide.",
  "Insufficient batch quantity": "La quantité du lot est insuffisante.",
  "Source and destination must be different":
    "La source et la destination doivent être différentes.",
  "This product is not tracked by serial number":
    "Ce produit n’est pas suivi par numéro de série.",
  "Serial number is required": "Un numéro de série est obligatoire.",
  "All units in stock already have a serial number":
    "Toutes les unités en stock possèdent déjà un numéro de série.",
  "A selected product or packaging is no longer available":
    "Un produit ou conditionnement sélectionné n’est plus disponible.",
  "Line designation is required": "La désignation de la ligne est obligatoire.",
  "Only one payment method is allowed at checkout":
    "Un seul moyen de paiement est autorisé à l’encaissement.",
  "Amount received is invalid": "Le montant reçu est invalide.",
  "Payment amount must be greater than zero":
    "Le montant du paiement doit être supérieur à zéro.",
  "Payment exceeds the sale total": "Le paiement dépasse le total de la vente.",
  "Sale request identifier is required":
    "L’identifiant de la demande de vente est obligatoire.",
  "Source quote is unavailable": "Le devis d’origine est indisponible.",
  "Quote lines changed; edit the draft quote before conversion":
    "Les lignes du devis ont changé ; modifiez le brouillon avant sa conversion.",
  "Customer credit usage cannot be negative":
    "Le crédit client utilisé ne peut pas être négatif.",
  "Veuillez sélectionner un client pour cette vente.":
    "Veuillez sélectionner un client pour cette vente.",
  "Veuillez sélectionner un client pour utiliser son solde.":
    "Veuillez sélectionner un client pour utiliser son solde.",
  "Le solde client disponible est insuffisant.":
    "Le solde client disponible est insuffisant.",
  "Veuillez sélectionner un client pour effectuer une vente à crédit.":
    "Veuillez sélectionner un client pour effectuer une vente à crédit.",
  "Suspended sale is unavailable": "La vente en attente est indisponible.",
  "Sale edit request identifier is required":
    "L’identifiant de la demande de modification de vente est obligatoire.",
  "The fulfillment mode cannot be changed after validation":
    "Le mode de vente ne peut pas être modifié après validation.",
  "A sale to deliver requires a valid customer":
    "Une vente à livrer nécessite un client valide.",
  "A sale line is invalid": "Une ligne de vente est invalide.",
  "A returned sale line cannot change product or packaging":
    "Une ligne déjà retournée ne peut pas changer de produit ou de conditionnement.",
  "Cette vente a déjà été expédiée. Les articles et quantités ne peuvent plus être modifiés.":
    "Cette vente a déjà été expédiée. Les articles et quantités ne peuvent plus être modifiés.",
  "A sale line linked to an invoice cannot be removed":
    "Une ligne de vente liée à une facture ne peut pas être supprimée.",
  "Insufficient stock for purchase correction":
    "Stock insuffisant pour corriger cet achat.",
  "An open cash session is required for a cash supplier refund":
    "Une session de caisse ouverte est obligatoire pour un remboursement fournisseur en espèces.",
  "Logo must be a PNG, JPEG or WebP image smaller than 1 MB":
    "Le logo doit être une image PNG, JPEG ou WebP de moins de 1 Mo.",
  "Unknown settings group": "Groupe de paramètres inconnu.",
  "Payload contains an unsupported setting":
    "La demande contient un paramètre non pris en charge.",
  "Default customer must be active": "Le client par défaut doit être actif.",
  "Quick checkout payment method must be active":
    "Le moyen de paiement rapide doit être actif.",
  "Default payment method must be active":
    "Le moyen de paiement par défaut doit être actif.",
  "Default warehouse must be active": "L’entrepôt par défaut doit être actif.",
  "Default cash register must be active":
    "La caisse par défaut doit être active.",
  "Default cash register must belong to the default warehouse":
    "La caisse par défaut doit appartenir à l’entrepôt par défaut.",
  "Cash payment method cannot be disabled":
    "Le moyen de paiement en espèces ne peut pas être désactivé.",
  "The default payment method cannot be disabled":
    "Le moyen de paiement par défaut ne peut pas être désactivé.",
  "Copies must be between 1 and 10":
    "Le nombre de copies doit être compris entre 1 et 10.",
  "Profile configuration must be an object":
    "La configuration du profil doit être un objet.",
  "Profile configuration contains an unsupported option":
    "La configuration du profil contient une option non prise en charge.",
  "Barcode symbology is invalid": "Le type de code-barres est invalide.",
  "Price position is invalid": "La position du prix est invalide.",
  "Invoice orientation is invalid": "L’orientation de la facture est invalide.",
  "Assigned printer must be active": "L’imprimante attribuée doit être active.",
  "Printer type is incompatible with this profile":
    "Le type d’imprimante est incompatible avec ce profil.",
  "Unsupported document sequence":
    "Cette séquence de documents n’est pas prise en charge.",
  "Username and password are required":
    "Le nom d’utilisateur et le mot de passe sont obligatoires.",
  "Invalid username or password":
    "Nom d’utilisateur ou mot de passe incorrect.",
  "User account is disabled": "Ce compte utilisateur est désactivé.",
  "Logged out": "Déconnexion effectuée.",
  "Failed to load cash registers": "Impossible de charger les caisses.",
  "Cash register not found": "Caisse introuvable.",
  "Failed to load cash register": "Impossible de charger la caisse.",
  "Failed to create cash register": "Impossible de créer la caisse.",
  "Failed to update cash register": "Impossible de modifier la caisse.",
  "Cash operations are not allowed for this role":
    "Ce rôle ne peut pas effectuer d’opérations de caisse.",
  "A valid active warehouse is required":
    "Un entrepôt actif et valide est obligatoire.",
  "A valid cash register is required": "Une caisse valide est obligatoire.",
  "Opening cash must be zero or greater":
    "Le fonds de caisse initial doit être positif ou nul.",
  "Cash register does not belong to the active warehouse":
    "Cette caisse n’appartient pas à l’entrepôt actif.",
  "Cash register is unauthorized":
    "Vous n’êtes pas autorisé à utiliser cette caisse.",
  "Cash register is not active": "Cette caisse n’est pas active.",
  "Cash session not found": "Session de caisse introuvable.",
  "Closing cash must be zero or greater":
    "Le montant de clôture doit être positif ou nul.",
  "A closing difference note is required":
    "Une justification de l’écart de caisse est obligatoire.",
  "You cannot close another user's cash session":
    "Vous ne pouvez pas clôturer la session de caisse d’un autre utilisateur.",
  "Cash session is already closed":
    "Cette session de caisse est déjà clôturée.",
  "Cash movement direction is invalid":
    "Le sens du mouvement de caisse est invalide.",
  "Amount must be greater than zero": "Le montant doit être supérieur à zéro.",
  "A reason or note is required": "Un motif ou une note est obligatoire.",
  "Cash history is not allowed for this role":
    "Ce rôle ne peut pas consulter l’historique de caisse.",
  "Cash session is unauthorized":
    "Vous n’êtes pas autorisé à accéder à cette session de caisse.",
  "Failed to load categories": "Impossible de charger les catégories.",
  "Failed to create category": "Impossible de créer la catégorie.",
  "Category not found": "Catégorie introuvable.",
  "Failed to update category": "Impossible de modifier la catégorie.",
  "Failed to update category status":
    "Impossible de modifier le statut de la catégorie.",
  "Only administrators and managers can manage customers":
    "Seuls les administrateurs et responsables peuvent gérer les clients.",
  "Failed to load customers": "Impossible de charger les clients.",
  "Customer not found": "Client introuvable.",
  "Failed to load customer": "Impossible de charger le client.",
  "Failed to create customer": "Impossible de créer le client.",
  "Failed to update customer": "Impossible de modifier le client.",
  "Customer status must be a boolean":
    "Le statut du client doit être une valeur booléenne.",
  "Failed to update customer status":
    "Impossible de modifier le statut du client.",
  "Warehouse is inactive or unauthorized":
    "L’entrepôt est inactif ou non autorisé.",
  "Failed to update product status":
    "Impossible de modifier le statut du produit.",
  "Failed to load warehouses": "Impossible de charger les entrepôts.",
  "Settings management is restricted to administrators and managers":
    "La gestion des paramètres est réservée aux administrateurs et responsables.",
  "Payment method status must be boolean":
    "Le statut du moyen de paiement doit être une valeur booléenne.",
  "Only administrators and managers can manage suppliers":
    "Seuls les administrateurs et responsables peuvent gérer les fournisseurs.",
  "Supplier not found": "Fournisseur introuvable.",
  "Failed to load supplier": "Impossible de charger le fournisseur.",
  "Failed to create supplier": "Impossible de créer le fournisseur.",
  "Failed to update supplier": "Impossible de modifier le fournisseur.",
  "Supplier status must be a boolean":
    "Le statut du fournisseur doit être une valeur booléenne.",
  "Failed to update supplier status":
    "Impossible de modifier le statut du fournisseur.",
  "Failed to load units": "Impossible de charger les unités.",
  "Failed to create unit": "Impossible de créer l’unité.",
  "Unit not found": "Unité introuvable.",
  "The built-in generic unit cannot be edited":
    "L’unité générique intégrée ne peut pas être modifiée.",
  "Failed to update unit": "Impossible de modifier l’unité.",
  "The built-in generic unit cannot be deactivated":
    "L’unité générique intégrée ne peut pas être désactivée.",
  "Failed to update unit status":
    "Impossible de modifier le statut de l’unité.",
  "Failed to load users": "Impossible de charger les utilisateurs.",
  "User not found": "Utilisateur introuvable.",
  "Failed to load user": "Impossible de charger l’utilisateur.",
  "Failed to create user": "Impossible de créer l’utilisateur.",
  "Failed to update user": "Impossible de modifier l’utilisateur.",
  "Warehouse name is required": "Le nom de l’entrepôt est obligatoire.",
  "Failed to create warehouse": "Impossible de créer l’entrepôt.",
  "Failed to load warehouse": "Impossible de charger l’entrepôt.",
  "Failed to update warehouse": "Impossible de modifier l’entrepôt.",
  "Customer account movement must be non-zero":
    "Le mouvement du compte client doit être différent de zéro.",
  "User already has an open cash session":
    "Cet utilisateur a déjà une session de caisse ouverte.",
  "Cash register already has an open session":
    "Cette caisse a déjà une session ouverte.",
  "Cash session is not open": "La session de caisse n’est pas ouverte.",
  "You cannot modify another user's cash session":
    "Vous ne pouvez pas modifier la session de caisse d’un autre utilisateur.",
  "Cash out amount exceeds theoretical cash":
    "La sortie de caisse dépasse le montant théorique disponible.",
  "Authentication required": "Authentification requise.",
  "Invalid authentication token": "Jeton d’authentification invalide.",
  "Session is invalid": "La session est invalide.",
});
Object.assign(translations.ar, {
  "A valid warehouse is required": "يجب اختيار مستودع صالح.",
  "Start date must precede end date":
    "يجب أن يسبق تاريخ البداية تاريخ النهاية.",
  "Backup file name is invalid": "اسم ملف النسخة الاحتياطية غير صالح.",
  "A backup scheduled for restoration cannot be deleted":
    "لا يمكن حذف النسخة الاحتياطية المجدولة للاستعادة.",
  "Close other application instances before restoring this backup":
    "أغلق النسخ الأخرى من التطبيق قبل استعادة هذه النسخة الاحتياطية.",
  "This commercial action is not allowed for your role":
    "هذا الإجراء التجاري غير مسموح لدورك.",
  "Quote request identifier is required": "معرّف طلب عرض السعر مطلوب.",
  "Quote date is invalid": "تاريخ عرض السعر غير صالح.",
  "Quote status transition is invalid": "تغيير حالة عرض السعر غير صالح.",
  "This sale does not require delivery": "عملية البيع هذه لا تتطلب تسليمًا.",
  "Delivery requires a customer": "يلزم تحديد عميل للتسليم.",
  "Add at least one delivery quantity": "أدخل كمية واحدة على الأقل للتسليم.",
  "Delivery quantity exceeds the remaining quantity":
    "كمية التسليم تتجاوز الكمية المتبقية.",
  "Delivery note not found": "سند التسليم غير موجود.",
  "Only a draft delivery can be validated":
    "لا يمكن اعتماد إلا سند تسليم في حالة مسودة.",
  "Only a draft delivery can be cancelled":
    "لا يمكن إلغاء إلا سند تسليم في حالة مسودة.",
  "A delivered BL is immutable; use a controlled return/correction document":
    "لا يمكن تعديل سند تسليم تم تسليمه؛ استخدم مستند إرجاع أو تصحيح موثق.",
  "Add at least one invoice quantity": "أدخل كمية واحدة على الأقل للفوترة.",
  "Invoice quantity exceeds the invoiceable quantity":
    "الكمية المطلوب فوترتها تتجاوز الكمية القابلة للفوترة.",
  "Add at least one return quantity": "أدخل كمية واحدة على الأقل للإرجاع.",
  "Return quantity exceeds the physically fulfilled quantity":
    "الكمية المرتجعة تتجاوز الكمية المسلّمة فعليًا.",
  "Serial return conflict": "تعارض في الأرقام التسلسلية للمرتجع.",
  "Return not found": "المرتجع غير موجود.",
  "Unsupported export type": "نوع التصدير هذا غير مدعوم.",
  "Only a prepared delivery can be shipped": "لا يمكن شحن إلا طلب تسليم مجهز.",
  "Delivery transition conflict": "تعارض أثناء تغيير حالة التسليم.",
  "Only a shipped delivery can be delivered": "لا يمكن تسليم إلا طلب تم شحنه.",
  "Invalid delivery transition": "تغيير حالة التسليم غير صالح.",
  "Warehouse is inactive or unavailable": "المستودع غير نشط أو غير متاح.",
  "This product does not track stock": "هذا المنتج لا يتتبع المخزون.",
  "Packaging is invalid or inactive": "التعبئة غير صالحة أو غير نشطة.",
  "Converted quantity is invalid": "الكمية المحوّلة غير صالحة.",
  "A valid expiration date is required": "تاريخ صلاحية صالح مطلوب.",
  "Purchase price must be zero or greater":
    "يجب أن يكون سعر الشراء صفرًا أو أكثر.",
  "Serialized quantity must be a whole number":
    "يجب أن تكون كمية المنتج ذي الرقم التسلسلي عددًا صحيحًا.",
  "Each stock unit requires one serial number":
    "تتطلب كل وحدة في المخزون رقمًا تسلسليًا واحدًا.",
  "Select one available serial number for each returned unit":
    "اختر رقمًا تسلسليًا متاحًا لكل وحدة مرتجعة.",
  "Not enough available serial numbers": "لا توجد أرقام تسلسلية متاحة كافية.",
  "Serial allocation conflict": "تعارض في تخصيص الأرقام التسلسلية.",
  "Adjustment direction is invalid": "اتجاه التسوية غير صالح.",
  "Insufficient batch quantity": "كمية الدفعة غير كافية.",
  "Source and destination must be different": "يجب أن يختلف المصدر عن الوجهة.",
  "Stock users cannot finalize sales":
    "لا يمكن لمستخدمي المخزون إتمام المبيعات.",
  "The selected warehouse cannot make sales":
    "المستودع المختار غير مخوّل بإجراء المبيعات.",
  "You cannot sell from another warehouse": "لا يمكنك البيع من مستودع آخر.",
  "This product is not tracked by serial number":
    "هذا المنتج لا يُتتبع بالرقم التسلسلي.",
  "Serial number is required": "الرقم التسلسلي مطلوب.",
  "All units in stock already have a serial number":
    "كل الوحدات في المخزون لديها أرقام تسلسلية بالفعل.",
  "A selected product or packaging is no longer available":
    "أحد المنتجات أو وحدات التعبئة المختارة لم يعد متاحًا.",
  "Line designation is required": "وصف السطر مطلوب.",
  "Backdating sales is not allowed for this user":
    "لا يسمح لهذا المستخدم بتأريخ المبيعات بأثر رجعي.",
  "Only one payment method is allowed at checkout":
    "يُسمح بطريقة دفع واحدة فقط عند التحصيل.",
  "Amount received is invalid": "المبلغ المستلم غير صالح.",
  "Payment amount must be greater than zero":
    "يجب أن يكون مبلغ الدفع أكبر من صفر.",
  "Payment exceeds the sale total": "الدفع يتجاوز إجمالي البيع.",
  "Sale request identifier is required": "معرّف طلب البيع مطلوب.",
  "Source quote is unavailable": "عرض السعر الأصلي غير متاح.",
  "Quote lines changed; edit the draft quote before conversion":
    "تغيرت بنود عرض السعر؛ عدّل المسودة قبل تحويلها.",
  "Customer credit usage cannot be negative":
    "لا يمكن أن يكون الرصيد الدائن المستخدم للعميل سالبًا.",
  "Veuillez sélectionner un client pour utiliser son solde.":
    "يرجى اختيار عميل لاستخدام رصيده.",
  "Veuillez sélectionner un client pour effectuer une vente à crédit.":
    "يرجى اختيار عميل لإجراء بيع آجل.",
  "Suspended sale is unavailable": "عملية البيع المعلقة غير متاحة.",
  "Sale editing is not allowed for this user":
    "لا يسمح لهذا المستخدم بتعديل المبيعات.",
  "Sale edit request identifier is required": "معرّف طلب تعديل البيع مطلوب.",
  "Only a confirmed sale can be edited": "لا يمكن تعديل إلا عملية بيع مؤكدة.",
  "The fulfillment mode cannot be changed after validation":
    "لا يمكن تغيير طريقة تنفيذ البيع بعد اعتماده.",
  "A sale to deliver requires a valid customer":
    "عملية البيع للتسليم تتطلب عميلًا صالحًا.",
  "A sale line is invalid": "أحد أسطر البيع غير صالح.",
  "A returned sale line cannot change product or packaging":
    "لا يمكن تغيير المنتج أو التعبئة لسطر بيع تم إرجاعه.",
  "Cette vente a déjà été expédiée. Les articles et quantités ne peuvent plus être modifiés.":
    "تم شحن هذه العملية بالفعل. لا يمكن تعديل الأصناف أو الكميات بعد الآن.",
  "A sale line linked to an invoice cannot be removed":
    "لا يمكن حذف سطر بيع مرتبط بفاتورة.",
  "Insufficient stock for purchase correction":
    "المخزون غير كافٍ لتصحيح هذا الشراء.",
  "An open cash session is required for a cash supplier refund":
    "يلزم وجود جلسة صندوق مفتوحة لردّ نقدي من المورد.",
  "You cannot access sales from this warehouse":
    "لا يمكنك الوصول إلى مبيعات هذا المستودع.",
  "Logo must be a PNG, JPEG or WebP image smaller than 1 MB":
    "يجب أن يكون الشعار صورة PNG أو JPEG أو WebP بحجم أقل من 1 ميغابايت.",
  "Unknown settings group": "مجموعة الإعدادات غير معروفة.",
  "Payload contains an unsupported setting": "يحتوي الطلب على إعداد غير مدعوم.",
  "Default customer must be active": "يجب أن يكون العميل الافتراضي نشطًا.",
  "Quick checkout payment method must be active":
    "يجب أن تكون طريقة الدفع السريع نشطة.",
  "Default payment method must be active":
    "يجب أن تكون طريقة الدفع الافتراضية نشطة.",
  "Default warehouse must be active": "يجب أن يكون المستودع الافتراضي نشطًا.",
  "Default cash register must be active":
    "يجب أن يكون الصندوق الافتراضي نشطًا.",
  "Default cash register must belong to the default warehouse":
    "يجب أن يتبع الصندوق الافتراضي المستودع الافتراضي.",
  "Cash payment method cannot be disabled": "لا يمكن تعطيل طريقة الدفع النقدي.",
  "The default payment method cannot be disabled":
    "لا يمكن تعطيل طريقة الدفع الافتراضية.",
  "Document type is invalid": "نوع المستند غير صالح.",
  "Copies must be between 1 and 10": "يجب أن يكون عدد النسخ بين 1 و10.",
  "Paper format is invalid": "تنسيق الورق غير صالح.",
  "Profile configuration must be an object":
    "يجب أن تكون إعدادات الملف التعريفي كائنًا.",
  "Profile configuration contains an unsupported option":
    "تحتوي إعدادات الملف التعريفي على خيار غير مدعوم.",
  "Barcode symbology is invalid": "نوع ترميز الباركود غير صالح.",
  "Price position is invalid": "موضع السعر غير صالح.",
  "Invoice orientation is invalid": "اتجاه الفاتورة غير صالح.",
  "Assigned printer must be active": "يجب أن تكون الطابعة المحددة نشطة.",
  "Printer type is incompatible with this profile":
    "نوع الطابعة غير متوافق مع هذا الملف التعريفي.",
  "Unsupported document sequence": "تسلسل المستندات هذا غير مدعوم.",
  "Username and password are required": "اسم المستخدم وكلمة المرور مطلوبان.",
  "Invalid username or password": "اسم المستخدم أو كلمة المرور غير صحيحة.",
  "User account is disabled": "حساب المستخدم هذا معطّل.",
  "Logged out": "تم تسجيل الخروج.",
  "Failed to load cash registers": "تعذر تحميل الصناديق.",
  "Cash register not found": "الصندوق غير موجود.",
  "Failed to load cash register": "تعذر تحميل الصندوق.",
  "Failed to create cash register": "تعذر إنشاء الصندوق.",
  "Failed to update cash register": "تعذر تعديل الصندوق.",
  "Cash operations are not allowed for this role":
    "لا يسمح لهذا الدور بإجراء عمليات الصندوق.",
  "A valid active warehouse is required": "يجب اختيار مستودع نشط وصالح.",
  "A valid cash register is required": "يجب اختيار صندوق صالح.",
  "Opening cash must be zero or greater":
    "يجب أن يكون الرصيد الافتتاحي صفرًا أو أكثر.",
  "Cash register does not belong to the active warehouse":
    "هذا الصندوق لا ينتمي إلى المستودع النشط.",
  "Cash register is unauthorized": "غير مصرح لك باستخدام هذا الصندوق.",
  "Cash register is not active": "هذا الصندوق غير نشط.",
  "Cash session not found": "جلسة الصندوق غير موجودة.",
  "Closing cash must be zero or greater":
    "يجب أن يكون مبلغ الإغلاق صفرًا أو أكثر.",
  "A closing difference note is required": "يلزم توضيح فرق الصندوق.",
  "You cannot close another user's cash session":
    "لا يمكنك إغلاق جلسة صندوق مستخدم آخر.",
  "Cash session is already closed": "جلسة الصندوق مغلقة بالفعل.",
  "Cash movement direction is invalid": "اتجاه حركة الصندوق غير صالح.",
  "Amount must be greater than zero": "يجب أن يكون المبلغ أكبر من صفر.",
  "A reason or note is required": "السبب أو الملاحظة مطلوبان.",
  "Cash history is not allowed for this role":
    "لا يسمح لهذا الدور بعرض سجل الصندوق.",
  "Cash session is unauthorized": "غير مصرح لك بالوصول إلى جلسة الصندوق هذه.",
  "Failed to load categories": "تعذر تحميل الفئات.",
  "Failed to create category": "تعذر إنشاء الفئة.",
  "Category not found": "الفئة غير موجودة.",
  "Failed to update category": "تعذر تعديل الفئة.",
  "Failed to update category status": "تعذر تعديل حالة الفئة.",
  "Only administrators and managers can manage customers":
    "إدارة العملاء متاحة للمشرفين والمديرين فقط.",
  "Failed to load customers": "تعذر تحميل العملاء.",
  "Customer not found": "العميل غير موجود.",
  "Failed to load customer": "تعذر تحميل العميل.",
  "Failed to create customer": "تعذر إنشاء العميل.",
  "Failed to update customer": "تعذر تعديل العميل.",
  "Customer status must be a boolean": "يجب أن تكون حالة العميل قيمة منطقية.",
  "Failed to update customer status": "تعذر تعديل حالة العميل.",
  "Warehouse is inactive or unauthorized": "المستودع غير نشط أو غير مصرح به.",
  "Failed to update product status": "تعذر تعديل حالة المنتج.",
  "Failed to load warehouses": "تعذر تحميل المستودعات.",
  "Settings management is restricted to administrators and managers":
    "إدارة الإعدادات متاحة للمشرفين والمديرين فقط.",
  "Payment method status must be boolean":
    "يجب أن تكون حالة طريقة الدفع قيمة منطقية.",
  "Only administrators and managers can manage suppliers":
    "إدارة الموردين متاحة للمشرفين والمديرين فقط.",
  "Supplier not found": "المورد غير موجود.",
  "Failed to load supplier": "تعذر تحميل المورد.",
  "Failed to create supplier": "تعذر إنشاء المورد.",
  "Failed to update supplier": "تعذر تعديل المورد.",
  "Supplier status must be a boolean": "يجب أن تكون حالة المورد قيمة منطقية.",
  "Failed to update supplier status": "تعذر تعديل حالة المورد.",
  "Failed to load units": "تعذر تحميل الوحدات.",
  "Failed to create unit": "تعذر إنشاء الوحدة.",
  "Unit not found": "الوحدة غير موجودة.",
  "The built-in generic unit cannot be edited":
    "لا يمكن تعديل الوحدة العامة المدمجة.",
  "Failed to update unit": "تعذر تعديل الوحدة.",
  "The built-in generic unit cannot be deactivated":
    "لا يمكن تعطيل الوحدة العامة المدمجة.",
  "Failed to update unit status": "تعذر تعديل حالة الوحدة.",
  "Failed to load users": "تعذر تحميل المستخدمين.",
  "User not found": "المستخدم غير موجود.",
  "Failed to load user": "تعذر تحميل المستخدم.",
  "Failed to create user": "تعذر إنشاء المستخدم.",
  "Failed to update user": "تعذر تعديل المستخدم.",
  "Warehouse name is required": "اسم المستودع مطلوب.",
  "Failed to create warehouse": "تعذر إنشاء المستودع.",
  "Failed to load warehouse": "تعذر تحميل المستودع.",
  "Failed to update warehouse": "تعذر تعديل المستودع.",
  "Customer account movement must be non-zero":
    "يجب ألا تكون حركة حساب العميل صفرًا.",
  "User already has an open cash session":
    "لدى هذا المستخدم جلسة صندوق مفتوحة بالفعل.",
  "Cash register already has an open session":
    "لدى هذا الصندوق جلسة مفتوحة بالفعل.",
  "Cash session is not open": "جلسة الصندوق غير مفتوحة.",
  "You cannot modify another user's cash session":
    "لا يمكنك تعديل جلسة صندوق مستخدم آخر.",
  "Cash out amount exceeds theoretical cash":
    "المبلغ المسحوب يتجاوز النقدية النظرية المتاحة.",
  "Authentication required": "المصادقة مطلوبة.",
  "Invalid authentication token": "رمز المصادقة غير صالح.",
  "Session is invalid": "الجلسة غير صالحة.",
});

const dynamic = {
  fr: [
    [
      /^Received quantity cannot be lower than the already used quantity \((.+)\)$/,
      "La quantité reçue ne peut pas être inférieure à la quantité déjà utilisée ($1).",
    ],
    [/^Row (\d+): (.+)$/, "Ligne $1 : $2"],
    [
      /^Serialized return quantity must be a whole number for (.+)$/,
      "La quantité retournée doit être entière pour le produit sérialisé $1.",
    ],
    [
      /^Not enough sold serial numbers remain returnable for (.+)$/,
      "Il ne reste pas assez de numéros de série vendus retournables pour $1.",
    ],
    [
      /^Not enough sold batch quantity remains returnable for (.+)$/,
      "Il ne reste pas assez de quantité retournable dans les lots vendus pour $1.",
    ],
    [
      /^Return quantity exceeds currently available stock for (.+)$/,
      "La quantité à retourner dépasse le stock actuellement disponible pour $1.",
    ],
    [/^Barcode (.+) already exists$/, "Le code-barres $1 existe déjà."],
    [
      /^(Minimum stock|Conversion factor|Purchase price|Selling price|Initial stock quantity|Batch purchase price) must be zero or greater$/,
      (_, label) =>
        `${{ "Minimum stock": "Le stock minimum", "Conversion factor": "Le facteur de conversion", "Purchase price": "Le prix d’achat", "Selling price": "Le prix de vente", "Initial stock quantity": "La quantité du stock initial", "Batch purchase price": "Le prix d’achat du lot" }[label]} doit être supérieur ou égal à zéro.`,
    ],
    [
      /^(track_stock|track_batches|track_expiration|track_serials) must be a boolean$/,
      "La valeur de l’option de suivi est invalide.",
    ],
    [/^Insufficient stock for (.+)$/, "Stock insuffisant pour $1."],
    [/^Batch required for (.+)$/, "Un lot est obligatoire pour $1."],
    [
      /^Serial numbers required for (.+)$/,
      "Les numéros de série sont obligatoires pour $1.",
    ],
    [
      /^Insufficient batch stock for (.+)$/,
      "Stock du lot insuffisant pour $1.",
    ],
    [/^Invalid price for (.+)$/, "Prix invalide pour $1."],
    [/^No valid batch stock for (.+)$/, "Aucun stock de lot valide pour $1."],
    [
      /^Payment remaining amount is (.+)$/,
      "Le montant restant à payer est de $1.",
    ],
    [/^Request failed \((\d+)\)$/, "La requête a échoué (code $1)."],
  ],
  ar: [
    [
      /^Received quantity cannot be lower than the already used quantity \((.+)\)$/,
      "لا يمكن أن تكون الكمية المستلمة أقل من الكمية المستخدمة بالفعل ($1).",
    ],
    [/^Row (\d+): (.+)$/, "السطر $1: $2"],
    [
      /^Serialized return quantity must be a whole number for (.+)$/,
      "يجب أن تكون الكمية المرتجعة عددًا صحيحًا للمنتج ذي الرقم التسلسلي $1.",
    ],
    [
      /^Not enough sold serial numbers remain returnable for (.+)$/,
      "لا توجد أرقام تسلسلية مباعة كافية قابلة للإرجاع للمنتج $1.",
    ],
    [
      /^Not enough sold batch quantity remains returnable for (.+)$/,
      "لا توجد كمية كافية قابلة للإرجاع من الدفعات المباعة للمنتج $1.",
    ],
    [
      /^Return quantity exceeds currently available stock for (.+)$/,
      "كمية الإرجاع تتجاوز المخزون المتاح حاليًا للمنتج $1.",
    ],
    [/^Barcode (.+) already exists$/, "الباركود $1 موجود مسبقًا."],
    [
      /^(Minimum stock|Conversion factor|Purchase price|Selling price|Initial stock quantity|Batch purchase price) must be zero or greater$/,
      "يجب أن تكون القيمة الرقمية أكبر من أو تساوي صفرًا.",
    ],
    [
      /^(track_stock|track_batches|track_expiration|track_serials) must be a boolean$/,
      "قيمة خيار التتبع غير صالحة.",
    ],
    [/^Insufficient stock for (.+)$/, "المخزون غير كافٍ للمنتج $1."],
    [/^Batch required for (.+)$/, "رقم الدفعة مطلوب للمنتج $1."],
    [
      /^Serial numbers required for (.+)$/,
      "الأرقام التسلسلية مطلوبة للمنتج $1.",
    ],
    [/^Insufficient batch stock for (.+)$/, "مخزون الدفعة غير كافٍ للمنتج $1."],
    [/^Invalid price for (.+)$/, "السعر غير صالح للمنتج $1."],
    [/^No valid batch stock for (.+)$/, "لا يوجد مخزون دفعة صالح للمنتج $1."],
    [/^Payment remaining amount is (.+)$/, "المبلغ المتبقي للدفع هو $1."],
    [/^Request failed \((\d+)\)$/, "فشل الطلب (الرمز $1)."],
  ],
};

Object.assign(translations.fr, {
  "designation is required": "la désignation est obligatoire",
  "serial and batch tracking cannot be combined":
    "le suivi par numéro de série et par lot ne peut pas être combiné",
  "name is required": "le nom est obligatoire",
  "expiration date must use YYYY-MM-DD":
    "la date d’expiration doit être au format AAAA-MM-JJ",
  "unit does not exist": "l’unité n’existe pas",
  "category does not exist": "la catégorie n’existe pas",
  "product reference does not exist": "la référence produit n’existe pas",
  "product does not track stock": "le produit ne suit pas le stock",
  "warehouse does not exist": "l’entrepôt n’existe pas",
  "warehouse is unauthorized": "l’entrepôt n’est pas autorisé",
  "each stock unit requires one serial number":
    "chaque unité en stock nécessite un numéro de série",
  "duplicate serial numbers are not allowed":
    "les numéros de série en double sont interdits",
  "batch or lot number is required": "le numéro de lot est obligatoire",
  "expiration date is required": "la date d’expiration est obligatoire",
  "product reference already exists": "la référence produit existe déjà",
  "partner already exists": "le partenaire existe déjà",
});
Object.assign(translations.ar, {
  "designation is required": "الوصف مطلوب",
  "serial and batch tracking cannot be combined":
    "لا يمكن الجمع بين تتبع الرقم التسلسلي والدفعة",
  "name is required": "الاسم مطلوب",
  "expiration date must use YYYY-MM-DD":
    "يجب أن يكون تاريخ الصلاحية بالصيغة YYYY-MM-DD",
  "unit does not exist": "الوحدة غير موجودة",
  "category does not exist": "الفئة غير موجودة",
  "product reference does not exist": "مرجع المنتج غير موجود",
  "product does not track stock": "المنتج لا يتتبع المخزون",
  "warehouse does not exist": "المستودع غير موجود",
  "warehouse is unauthorized": "المستودع غير مصرح به",
  "each stock unit requires one serial number":
    "كل وحدة في المخزون تحتاج إلى رقم تسلسلي",
  "duplicate serial numbers are not allowed":
    "الأرقام التسلسلية المكررة غير مسموح بها",
  "batch or lot number is required": "رقم الدفعة مطلوب",
  "expiration date is required": "تاريخ الصلاحية مطلوب",
  "product reference already exists": "مرجع المنتج موجود مسبقًا",
  "partner already exists": "الشريك موجود مسبقًا",
});

dynamic.fr.unshift(
  [
    /^Row (\d+): (.+)$/,
    (_, row, reason) => `Ligne ${row} : ${translateErrorMessage(reason, "fr")}`,
  ],
  [/^Missing required columns: (.+)$/, "Colonnes obligatoires manquantes : $1"],
  [
    /^Serial-tracked product (.+) is not supported for delivery validation$/,
    "Le produit sérialisé $1 ne peut pas être validé dans cette livraison.",
  ],
  [
    /^Price editing is not allowed for (.+)$/,
    "La modification du prix n’est pas autorisée pour $1.",
  ],
  [
    /^Discount exceeds the allowed limit of (.+)%$/,
    "La remise dépasse la limite autorisée de $1 %.",
  ],
  [
    /^Global discount exceeds the allowed limit of (.+)%$/,
    "La remise globale dépasse la limite autorisée de $1 %.",
  ],
  [
    /^Serialized quantity must be a whole number for (.+)$/,
    "La quantité du produit sérialisé $1 doit être entière.",
  ],
  [
    /^Select one serial number for each unit of (.+)$/,
    "Sélectionnez un numéro de série pour chaque unité de $1.",
  ],
  [
    /^Not enough available serial numbers for (.+)$/,
    "Il n’y a pas assez de numéros de série disponibles pour $1.",
  ],
  [
    /^Each stock unit requires one serial number for (.+)$/,
    "Chaque unité en stock de $1 nécessite un numéro de série.",
  ],
  [
    /^Serial number (.+) is no longer available and cannot be removed$/,
    "Le numéro de série $1 n’est plus disponible et ne peut pas être retiré.",
  ],
  [
    /^Batch number is required for (.+)$/,
    "Un numéro de lot est obligatoire pour $1.",
  ],
  [
    /^Batch (.+) no longer contains enough stock for this correction$/,
    "Le lot $1 ne contient plus assez de stock pour cette correction.",
  ],
  [/^Unsupported setting: (.+)$/, "Paramètre non pris en charge : $1"],
  [/^(.+) must be greater than zero$/, "$1 doit être supérieur à zéro."],
  [/^(.+) must be boolean$/, "La valeur de $1 doit être booléenne."],
  [/^(.+) must be numeric$/, "La valeur de $1 doit être numérique."],
  [/^(.+) is outside the allowed range$/, "$1 est hors de la plage autorisée."],
  [/^(.+) is invalid$/, "$1 est invalide."],
  [/^(.+) has an invalid format$/, "Le format de $1 est invalide."],
);
dynamic.ar.unshift(
  [
    /^Row (\d+): (.+)$/,
    (_, row, reason) => `السطر ${row}: ${translateErrorMessage(reason, "ar")}`,
  ],
  [/^Missing required columns: (.+)$/, "الأعمدة المطلوبة مفقودة: $1"],
  [
    /^Serial-tracked product (.+) is not supported for delivery validation$/,
    "لا يمكن اعتماد المنتج ذي الرقم التسلسلي $1 في هذا التسليم.",
  ],
  [
    /^Price editing is not allowed for (.+)$/,
    "تعديل السعر غير مسموح للمنتج $1.",
  ],
  [
    /^Discount exceeds the allowed limit of (.+)%$/,
    "الخصم يتجاوز الحد المسموح به $1%.",
  ],
  [
    /^Global discount exceeds the allowed limit of (.+)%$/,
    "الخصم الإجمالي يتجاوز الحد المسموح به $1%.",
  ],
  [
    /^Serialized quantity must be a whole number for (.+)$/,
    "يجب أن تكون كمية المنتج ذي الرقم التسلسلي $1 عددًا صحيحًا.",
  ],
  [
    /^Select one serial number for each unit of (.+)$/,
    "اختر رقمًا تسلسليًا لكل وحدة من $1.",
  ],
  [
    /^Not enough available serial numbers for (.+)$/,
    "لا توجد أرقام تسلسلية متاحة كافية للمنتج $1.",
  ],
  [
    /^Each stock unit requires one serial number for (.+)$/,
    "كل وحدة مخزون من $1 تحتاج إلى رقم تسلسلي.",
  ],
  [
    /^Serial number (.+) is no longer available and cannot be removed$/,
    "الرقم التسلسلي $1 لم يعد متاحًا ولا يمكن إزالته.",
  ],
  [/^Batch number is required for (.+)$/, "رقم الدفعة مطلوب للمنتج $1."],
  [
    /^Batch (.+) no longer contains enough stock for this correction$/,
    "الدفعة $1 لم تعد تحتوي على مخزون كافٍ لهذا التصحيح.",
  ],
  [/^Unsupported setting: (.+)$/, "إعداد غير مدعوم: $1"],
  [/^(.+) must be greater than zero$/, "يجب أن تكون قيمة $1 أكبر من صفر."],
  [/^(.+) must be boolean$/, "يجب أن تكون قيمة $1 منطقية."],
  [/^(.+) must be numeric$/, "يجب أن تكون قيمة $1 رقمية."],
  [/^(.+) is outside the allowed range$/, "$1 خارج النطاق المسموح به."],
  [/^(.+) is invalid$/, "$1 غير صالح."],
  [/^(.+) has an invalid format$/, "تنسيق $1 غير صالح."],
  [
    /^La quantité de (.+) ne peut pas être inférieure à la quantité déjà retournée \((.+)\)\.$/,
    "لا يمكن أن تكون كمية $1 أقل من الكمية المرتجعة بالفعل ($2).",
  ],
);
dynamic.en = [
  [
    /^La quantité de (.+) ne peut pas être inférieure à la quantité déjà retournée \((.+)\)\.$/,
    "The quantity of $1 cannot be lower than the quantity already returned ($2).",
  ],
];

Object.assign(translations.en, {
  "A restore is already scheduled":
    "A restore is already scheduled. Restart the API server before scheduling another.",
});
Object.assign(translations.fr, {
  "A restore is already scheduled":
    "Une restauration est déjà programmée. Redémarrez le serveur API avant d’en programmer une autre.",
});
Object.assign(translations.ar, {
  "A restore is already scheduled":
    "تمت جدولة استعادة بالفعل. أعد تشغيل خادم API قبل جدولة استعادة أخرى.",
});

const alreadyLocalized = { fr: /[àâçéèêëîïôùûüœ]/i, ar: /[\u0600-\u06ff]/ };

Object.assign(translations.en, {
  "API URL is invalid": "The API URL is invalid.",
  "API URL must use HTTP or HTTPS without credentials":
    "The API URL must use HTTP or HTTPS and must not contain credentials.",
  "The server is not a compatible MODERN API":
    "The server is not a compatible MODERN API.",
  "The API connection timed out": "The API connection timed out.",
  "The local API did not start": "The local API did not start.",
  "Type SUPPRIMER to confirm this destructive operation":
    "Type SUPPRIMER to confirm this destructive operation.",
});
Object.assign(translations.fr, {
  "API URL is invalid": "L’URL de l’API est invalide.",
  "API URL must use HTTP or HTTPS without credentials":
    "L’URL doit utiliser HTTP ou HTTPS et ne doit contenir aucun identifiant.",
  "The server is not a compatible MODERN API":
    "Le serveur n’est pas une API MODERN compatible.",
  "The API connection timed out": "Le délai de connexion à l’API est dépassé.",
  "The local API did not start": "L’API locale n’a pas démarré.",
  "Type SUPPRIMER to confirm this destructive operation":
    "Saisissez SUPPRIMER pour confirmer cette opération destructive.",
});
Object.assign(translations.ar, {
  "API URL is invalid":
    "\u0639\u0646\u0648\u0627\u0646 API \u063a\u064a\u0631 \u0635\u0627\u0644\u062d.",
  "API URL must use HTTP or HTTPS without credentials":
    "\u064a\u062c\u0628 \u0623\u0646 \u064a\u0633\u062a\u062e\u062f\u0645 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 HTTP \u0623\u0648 HTTPS \u0645\u0646 \u062f\u0648\u0646 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0639\u062a\u0645\u0627\u062f.",
  "The server is not a compatible MODERN API":
    "\u0627\u0644\u062e\u0627\u062f\u0645 \u0644\u064a\u0633 API MODERN \u0645\u062a\u0648\u0627\u0641\u0642\u0627\u064b.",
  "The API connection timed out":
    "\u0627\u0646\u062a\u0647\u062a \u0645\u0647\u0644\u0629 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0640 API.",
  "The local API did not start":
    "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0634\u063a\u064a\u0644 API \u0627\u0644\u0645\u062d\u0644\u064a.",
  "Type SUPPRIMER to confirm this destructive operation":
    "\u0627\u0643\u062a\u0628 SUPPRIMER \u0644\u062a\u0623\u0643\u064a\u062f \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u0645\u062f\u0645\u0631\u0629.",
});

Object.assign(translations.en, {
  "The SQL file contains an unterminated string": "The SQL file contains an unterminated string.",
  "The SQL import accepts only literal INSERT values": "The SQL import accepts only literal INSERT values.",
  "The SQL file is empty": "The SQL file is empty.",
  "SQL INSERT columns and values do not match": "SQL INSERT columns and values do not match.",
  "Only INSERT statements generated by POS Modern are supported": "Only INSERT statements generated by POS Modern are supported.",
  "SQL export is unavailable for reports": "SQL export is unavailable for reports.",
});
Object.assign(translations.fr, {
  "The SQL file contains an unterminated string": "Le fichier SQL contient une chaîne de caractères non terminée.",
  "The SQL import accepts only literal INSERT values": "L’import SQL accepte uniquement des valeurs littérales dans les instructions INSERT.",
  "The SQL file is empty": "Le fichier SQL est vide.",
  "SQL INSERT columns and values do not match": "Les colonnes et les valeurs de l’instruction SQL INSERT ne correspondent pas.",
  "Only INSERT statements generated by POS Modern are supported": "Seules les instructions INSERT générées par POS Modern sont acceptées.",
  "SQL export is unavailable for reports": "L’export SQL n’est pas disponible pour les rapports.",
});
Object.assign(translations.ar, {
  "The SQL file contains an unterminated string": "يحتوي ملف SQL على نص غير مكتمل.",
  "The SQL import accepts only literal INSERT values": "يقبل استيراد SQL القيم المباشرة فقط داخل تعليمات INSERT.",
  "The SQL file is empty": "ملف SQL فارغ.",
  "SQL INSERT columns and values do not match": "أعمدة وقيم تعليمة SQL INSERT غير متطابقة.",
  "Only INSERT statements generated by POS Modern are supported": "يتم قبول تعليمات INSERT التي أنشأها POS Modern فقط.",
  "SQL export is unavailable for reports": "تصدير SQL غير متاح للتقارير.",
});
dynamic.fr.push([
  /^SQL table (.+) does not match import type (.+)$/,
  "La table SQL $1 ne correspond pas au type d’import $2.",
]);
dynamic.ar.push([
  /^SQL table (.+) does not match import type (.+)$/,
  "جدول SQL ‏$1 لا يطابق نوع الاستيراد $2.",
]);

Object.assign(translations.fr, {
  "You cannot access warranties from this warehouse": "Vous ne pouvez pas consulter les garanties de cet entrepôt.",
  "Warranty duration is invalid": "La durée de garantie est invalide.",
  "Warranty duration unit is invalid": "L’unité de durée de garantie est invalide.",
  "Invoiced price is invalid": "Le prix facturé est invalide.",
  "Product package is invalid": "Le conditionnement du produit est invalide.",
  "Warranty not found": "Garantie introuvable.",
  "Required warranty information is missing": "Renseignez les informations obligatoires de la garantie.",
  "A serial number is required for this warranty": "Le numéro de série est obligatoire pour cette garantie.",
  "A batch number is required for this warranty": "Le numéro de lot est obligatoire pour cette garantie.",
});
Object.assign(translations.ar, {
  "You cannot access warranties from this warehouse": "لا يمكنك الاطلاع على ضمانات هذا المستودع.",
  "Warranty duration is invalid": "مدة الضمان غير صالحة.",
  "Warranty duration unit is invalid": "وحدة مدة الضمان غير صالحة.",
  "Invoiced price is invalid": "السعر المفوتر غير صالح.",
  "Product package is invalid": "تعبئة المنتج غير صالحة.",
  "Warranty not found": "الضمان غير موجود.",
  "Required warranty information is missing": "أدخل معلومات الضمان الإلزامية.",
  "A serial number is required for this warranty": "الرقم التسلسلي إلزامي لهذا الضمان.",
  "A batch number is required for this warranty": "رقم الدفعة إلزامي لهذا الضمان.",
});

export function translateErrorMessage(message, language) {
  const text = String(message || "").trim();
  if (!text) return text;
  const exact = translations[language]?.[text];
  if (exact) return exact;
  for (const [pattern, replacement] of dynamic[language] || []) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  if (language === "en" || alreadyLocalized[language]?.test(text)) return text;
  return language === "ar"
    ? `تفاصيل الخطأ: ${text}`
    : `Détail de l’erreur : ${text}`;
}
