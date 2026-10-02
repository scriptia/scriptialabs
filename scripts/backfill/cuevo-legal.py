"""Generate the translated privacy, terms, contact and deletion documents for Cuevo."""

import json
import os

UPDATED = "2026-10-02"
SUPPORT = "support@scriptiastories.com"
PRIVACY = "privacy@scriptiastories.com"
SECURITY = "security@scriptiastories.com"
LEGAL = "legal@scriptiastories.com"


def sec(id_, title, en, es, ca):
    return {"id": id_, "title": dict(zip(("en", "es", "ca"), title)), "body": {"en": en, "es": es, "ca": ca}}


def doc(key, slug, title, description, sections, label=None):
    value = {
        "docKey": key,
        "slug": slug,
        "lastUpdated": UPDATED,
        "title": dict(zip(("en", "es", "ca"), title)),
        "description": dict(zip(("en", "es", "ca"), description)),
        "sections": sections,
    }
    if label:
        value["labelKey"] = label
    return value


privacy = doc(
    "privacy", "privacy",
    ("Cuevo Privacy Policy", "Política de privacidad de Cuevo", "Política de privacitat de Cuevo"),
    (
        "How Cuevo handles scripts, recordings, speech, purchases and device permissions.",
        "Cómo trata Cuevo los guiones, grabaciones, voz, compras y permisos del dispositivo.",
        "Com tracta Cuevo els guions, les gravacions, la veu, les compres i els permisos del dispositiu.",
    ),
    [
        sec("introduction", ("Introduction", "Introducción", "Introducció"),
            ["Cuevo is a teleprompter and video recorder developed by Idion. This policy applies to the Cuevo app for iPhone, iPad and Apple Watch.", "Cuevo requires no account and has no Idion server for scripts, recordings, transcripts or coaching results."],
            ["Cuevo es un teleprompter y grabador de vídeo desarrollado por Idion. Esta política se aplica a Cuevo para iPhone, iPad y Apple Watch.", "Cuevo no requiere cuenta y no tiene un servidor de Idion para guiones, grabaciones, transcripciones ni resultados del análisis."],
            ["Cuevo és un teleprompter i gravador de vídeo desenvolupat per Idion. Aquesta política s'aplica a Cuevo per a iPhone, iPad i Apple Watch.", "Cuevo no requereix compte i no té cap servidor d'Idion per a guions, gravacions, transcripcions ni resultats de l'anàlisi."]),
        sec("content", ("Scripts, recordings and analysis", "Guiones, grabaciones y análisis", "Guions, gravacions i anàlisi"),
            ["Scripts, imported documents, videos, transcripts and delivery metrics are processed and stored on your device. Speech recognition and face-direction analysis run on device. Cuevo does not upload this content to Idion.", "Videos remain in Cuevo's app container until you export or delete them. Exporting to Photos or another app happens only when you choose it."],
            ["Los guiones, documentos importados, vídeos, transcripciones y métricas se procesan y guardan en tu dispositivo. El reconocimiento de voz y el análisis de la dirección del rostro se ejecutan en el dispositivo. Cuevo no sube este contenido a Idion.", "Los vídeos permanecen en el contenedor de Cuevo hasta que los exportas o eliminas. Solo se exportan a Fotos u otra app cuando tú lo decides."],
            ["Els guions, documents importats, vídeos, transcripcions i mètriques es processen i es desen al dispositiu. El reconeixement de veu i l'anàlisi de la direcció del rostre s'executen al dispositiu. Cuevo no puja aquest contingut a Idion.", "Els vídeos romanen al contenidor de Cuevo fins que els exportes o elimines. Només s'exporten a Fotos o una altra app quan tu ho decideixes."]),
        sec("icloud", ("Private iCloud sync", "Sincronización privada con iCloud", "Sincronització privada amb iCloud"),
            ["If iCloud sync is enabled, scripts and their metadata can sync through Apple's CloudKit private database. The database belongs to your Apple Account and is handled under Apple's privacy policy. Videos do not sync through CloudKit."],
            ["Si activas la sincronización con iCloud, los guiones y sus metadatos pueden sincronizarse mediante la base privada de CloudKit de Apple. La base pertenece a tu cuenta de Apple y se trata según la política de Apple. Los vídeos no se sincronizan por CloudKit."],
            ["Si actives la sincronització amb iCloud, els guions i les metadades es poden sincronitzar mitjançant la base privada de CloudKit d'Apple. La base pertany al teu compte d'Apple i es tracta segons la política d'Apple. Els vídeos no se sincronitzen per CloudKit."]),
        sec("permissions", ("Device permissions", "Permisos del dispositivo", "Permisos del dispositiu"),
            ["Microphone and speech recognition are used to record audio and follow your spoken words. Camera access records video. Photos access is requested only when you save an export. Local-network and Bluetooth connectivity let a nearby device, Apple Watch, keyboard or pedal control the prompter. Cuevo does not use location, contacts or advertising identifiers."],
            ["El micrófono y el reconocimiento de voz se usan para grabar audio y seguir tus palabras. La cámara graba vídeo. Fotos solo se solicita al guardar una exportación. La red local y Bluetooth permiten que otro dispositivo, Apple Watch, teclado o pedal controlen el teleprompter. Cuevo no usa ubicación, contactos ni identificadores publicitarios."],
            ["El micròfon i el reconeixement de veu s'utilitzen per gravar àudio i seguir les teves paraules. La càmera grava vídeo. Fotos només se sol·licita en desar una exportació. La xarxa local i Bluetooth permeten que un altre dispositiu, Apple Watch, teclat o pedal controlin el teleprompter. Cuevo no usa ubicació, contactes ni identificadors publicitaris."]),
        sec("purchases", ("Subscriptions and payments", "Suscripciones y pagos", "Subscripcions i pagaments"),
            ["Apple processes all App Store purchases. We never receive card or banking details. RevenueCat receives App Store purchase history and a random app user identifier to determine whether Cuevo Pro is active and restore access on your devices. That identifier is not linked by Cuevo to a name or email."],
            ["Apple procesa todas las compras del App Store. Nunca recibimos datos bancarios ni de tarjeta. RevenueCat recibe el historial de compras y un identificador aleatorio para determinar si Cuevo Pro está activo y restaurarlo en tus dispositivos. Cuevo no vincula ese identificador con un nombre o correo."],
            ["Apple processa totes les compres de l'App Store. Mai no rebem dades bancàries ni de targeta. RevenueCat rep l'historial de compres i un identificador aleatori per determinar si Cuevo Pro està actiu i restaurar-lo als teus dispositius. Cuevo no vincula aquest identificador amb cap nom o correu."]),
        sec("sharing", ("Sharing, tracking and advertising", "Cesión, rastreo y publicidad", "Cessió, seguiment i publicitat"),
            ["Cuevo has no advertising and does not track you across apps or websites. We do not sell personal information. Nearby remote traffic is encrypted and is used only to transmit control commands."],
            ["Cuevo no tiene publicidad ni te rastrea entre apps o webs. No vendemos información personal. El tráfico del mando cercano está cifrado y solo transmite órdenes de control."],
            ["Cuevo no té publicitat ni et rastreja entre apps o webs. No venem informació personal. El trànsit del comandament proper està xifrat i només transmet ordres de control."]),
        sec("retention", ("Retention and deletion", "Conservación y eliminación", "Conservació i eliminació"),
            ["Your content stays on your device or in your private iCloud until you delete it. Deleting a take removes its local video. Deleting the app removes its local data. Apple and RevenueCat retain purchase records under their policies and legal obligations."],
            ["Tu contenido permanece en el dispositivo o en tu iCloud privado hasta que lo borras. Borrar una toma elimina su vídeo local. Borrar la app elimina los datos locales. Apple y RevenueCat conservan registros de compra según sus políticas y obligaciones legales."],
            ["El teu contingut roman al dispositiu o al teu iCloud privat fins que l'esborres. Esborrar una presa elimina el vídeo local. Esborrar l'app elimina les dades locals. Apple i RevenueCat conserven registres de compra segons les seves polítiques i obligacions legals."]),
        sec("rights", ("Your rights and contact", "Tus derechos y contacto", "Els teus drets i contacte"),
            ["Depending on where you live, you may have rights to access, correct, delete or port personal information and object to processing. Most Cuevo data is controlled directly on your device. For purchase records or privacy questions, contact " + PRIVACY + "."],
            ["Según dónde vivas, puedes tener derecho a acceder, rectificar, suprimir o portar información y oponerte al tratamiento. La mayoría de los datos de Cuevo se controlan directamente en tu dispositivo. Para registros de compra o dudas de privacidad, escribe a " + PRIVACY + "."],
            ["Segons on visquis, pots tenir dret a accedir, rectificar, suprimir o portar informació i oposar-te al tractament. La majoria de dades de Cuevo es controlen directament al dispositiu. Per a registres de compra o dubtes de privacitat, escriu a " + PRIVACY + "."]),
    ],
)

terms = doc(
    "terms", "terms",
    ("Cuevo Terms of Use", "Términos de uso de Cuevo", "Termes d'ús de Cuevo"),
    ("The terms that apply when you use Cuevo and Cuevo Pro.", "Los términos aplicables al usar Cuevo y Cuevo Pro.", "Els termes aplicables quan uses Cuevo i Cuevo Pro."),
    [
        sec("agreement", ("Agreement and licence", "Acuerdo y licencia", "Acord i llicència"),
            ["Your use of Cuevo is governed by Apple's Standard Licensed Application End User License Agreement and these product-specific terms. Cuevo grants no rights beyond that standard licence."],
            ["El uso de Cuevo se rige por el Contrato de licencia de usuario final estándar de Apple y por estos términos específicos. Cuevo no concede derechos adicionales a esa licencia."],
            ["L'ús de Cuevo es regeix pel Contracte de llicència d'usuari final estàndard d'Apple i per aquests termes específics. Cuevo no concedeix drets addicionals a aquesta llicència."]),
        sec("yourContent", ("Your content", "Tu contenido", "El teu contingut"),
            ["You retain ownership of scripts, recordings and exports. You are responsible for having the rights and permissions needed to record people, locations, documents, music or other material and to publish the result."],
            ["Conservas la propiedad de tus guiones, grabaciones y exportaciones. Eres responsable de disponer de los derechos y permisos necesarios para grabar personas, lugares, documentos, música u otros materiales y publicar el resultado."],
            ["Conserves la propietat dels guions, gravacions i exportacions. Ets responsable de disposar dels drets i permisos necessaris per gravar persones, llocs, documents, música o altres materials i publicar-ne el resultat."]),
        sec("subscriptions", ("Subscriptions and free trials", "Suscripciones y pruebas gratuitas", "Subscripcions i proves gratuïtes"),
            ["Prices and billing periods are shown before purchase. An eligible free trial becomes a paid auto-renewing subscription when the trial ends unless you cancel at least 24 hours before the end of the current period. Apple charges your Apple Account. Manage or cancel subscriptions in App Store settings. Deleting Cuevo does not cancel a subscription."],
            ["Los precios y periodos se muestran antes de comprar. Una prueba gratuita elegible se convierte en suscripción de pago con renovación automática al terminar, salvo que canceles al menos 24 horas antes del final del periodo. Apple cobra en tu cuenta de Apple. Gestiona o cancela en los ajustes del App Store. Borrar Cuevo no cancela la suscripción."],
            ["Els preus i períodes es mostren abans de comprar. Una prova gratuïta elegible es converteix en subscripció de pagament amb renovació automàtica en acabar, tret que cancel·lis almenys 24 hores abans del final del període. Apple cobra al teu compte d'Apple. Gestiona o cancel·la als ajustos de l'App Store. Esborrar Cuevo no cancel·la la subscripció."]),
        sec("output", ("Prompter and coaching output", "Resultados del teleprompter y análisis", "Resultats del teleprompter i l'anàlisi"),
            ["Voice alignment, transcripts, captions and coaching metrics can contain errors. Review scripts and exports before relying on or publishing them. Eye-line and speaking metrics are practice feedback, not professional, medical or accessibility advice."],
            ["La alineación de voz, transcripciones, subtítulos y métricas pueden contener errores. Revisa los guiones y exportaciones antes de usarlos o publicarlos. Las métricas son feedback de práctica, no consejo profesional, médico ni de accesibilidad."],
            ["L'alineació de veu, les transcripcions, els subtítols i les mètriques poden contenir errors. Revisa els guions i exportacions abans d'usar-los o publicar-los. Les mètriques són retorn de pràctica, no consell professional, mèdic ni d'accessibilitat."]),
        sec("acceptableUse", ("Acceptable use", "Uso aceptable", "Ús acceptable"),
            ["Do not use Cuevo unlawfully, to violate privacy or intellectual-property rights, to bypass safety restrictions, or to interfere with the app, App Store or nearby devices."],
            ["No uses Cuevo de forma ilegal, para vulnerar la privacidad o propiedad intelectual, eludir restricciones de seguridad o interferir con la app, el App Store o dispositivos cercanos."],
            ["No facis servir Cuevo il·legalment, per vulnerar la privacitat o la propietat intel·lectual, eludir restriccions de seguretat o interferir amb l'app, l'App Store o dispositius propers."]),
        sec("availability", ("Availability and changes", "Disponibilidad y cambios", "Disponibilitat i canvis"),
            ["Features depend on device hardware, operating-system support, speech models and permissions. We may improve, change or discontinue features. We do not promise uninterrupted or error-free operation, but we design recording to preserve completed files when possible."],
            ["Las funciones dependen del hardware, sistema operativo, modelos de voz y permisos. Podemos mejorar, cambiar o retirar funciones. No garantizamos un funcionamiento ininterrumpido o sin errores, aunque diseñamos la grabación para conservar los archivos terminados siempre que sea posible."],
            ["Les funcions depenen del maquinari, sistema operatiu, models de veu i permisos. Podem millorar, canviar o retirar funcions. No garantim un funcionament ininterromput o sense errors, tot i que dissenyem la gravació per conservar els fitxers acabats sempre que sigui possible."]),
        sec("contact", ("Contact", "Contacto", "Contacte"),
            ["For support contact " + SUPPORT + ". For legal questions contact " + LEGAL + "."],
            ["Para soporte escribe a " + SUPPORT + ". Para consultas legales escribe a " + LEGAL + "."],
            ["Per a suport escriu a " + SUPPORT + ". Per a consultes legals escriu a " + LEGAL + "."]),
    ],
    label="termsEula",
)

contact = doc(
    "contact", "contact",
    ("Contact Cuevo", "Contactar con Cuevo", "Contactar amb Cuevo"),
    ("Support, privacy, security and legal contacts.", "Contactos de soporte, privacidad, seguridad y asuntos legales.", "Contactes de suport, privacitat, seguretat i assumptes legals."),
    [
        sec("support", ("Product support", "Soporte del producto", "Suport del producte"), ["For help with Cuevo, purchases, imports, recording or exports, contact " + SUPPORT + "."], ["Para ayuda con Cuevo, compras, importaciones, grabación o exportaciones, escribe a " + SUPPORT + "."], ["Per a ajuda amb Cuevo, compres, importacions, gravació o exportacions, escriu a " + SUPPORT + "."]),
        sec("privacy", ("Privacy", "Privacidad", "Privacitat"), ["For privacy questions or data-rights requests, contact " + PRIVACY + "."], ["Para consultas de privacidad o derechos sobre datos, escribe a " + PRIVACY + "."], ["Per a consultes de privacitat o drets sobre dades, escriu a " + PRIVACY + "."]),
        sec("security", ("Security", "Seguridad", "Seguretat"), ["Report security vulnerabilities privately to " + SECURITY + "."], ["Comunica vulnerabilidades de seguridad de forma privada a " + SECURITY + "."], ["Comunica vulnerabilitats de seguretat de manera privada a " + SECURITY + "."]),
        sec("legal", ("Legal", "Legal", "Legal"), ["For legal enquiries contact " + LEGAL + "."], ["Para consultas legales escribe a " + LEGAL + "."], ["Per a consultes legals escriu a " + LEGAL + "."]),
        sec("response", ("Response time and languages", "Plazo e idiomas", "Termini i idiomes"), ["We aim to reply within a few business days in English, Spanish or Catalan."], ["Intentamos responder en pocos días laborables en inglés, español o catalán."], ["Intentem respondre en pocs dies laborables en anglès, castellà o català."]),
    ],
)

deletion = doc(
    "dataDeletion", "data-deletion",
    ("Delete your Cuevo data", "Eliminar tus datos de Cuevo", "Eliminar les teves dades de Cuevo"),
    ("How to remove scripts, recordings, iCloud data and subscription records.", "Cómo borrar guiones, grabaciones, datos de iCloud y registros de suscripción.", "Com esborrar guions, gravacions, dades d'iCloud i registres de subscripció."),
    [
        sec("inApp", ("Delete in Cuevo", "Borrar en Cuevo", "Esborrar a Cuevo"), ["Delete an individual script or take from its list. Deleting a take also removes its video file. Use Delete all data in Settings to remove all Cuevo content from the device. Cuevo has no account to close."], ["Borra un guion o una toma desde su lista. Borrar una toma también elimina su archivo de vídeo. Usa Eliminar todos los datos en Ajustes para borrar todo el contenido del dispositivo. Cuevo no tiene una cuenta que cerrar."], ["Esborra un guió o una presa des de la seva llista. Esborrar una presa també elimina el fitxer de vídeo. Fes servir Elimina totes les dades als Ajustos per esborrar tot el contingut del dispositiu. Cuevo no té cap compte per tancar."]),
        sec("icloud", ("Delete the iCloud copy", "Borrar la copia de iCloud", "Esborrar la còpia d'iCloud"), ["When iCloud sync is active, deleting a script removes it from your private CloudKit database. To remove all Cuevo data stored in iCloud, open device Settings, choose your Apple Account, iCloud, Manage Account Storage, Cuevo, then delete its data."], ["Con iCloud activo, borrar un guion lo elimina de tu base privada de CloudKit. Para borrar todos los datos de Cuevo en iCloud, abre Ajustes, tu cuenta de Apple, iCloud, Gestionar almacenamiento, Cuevo y elimina sus datos."], ["Amb iCloud actiu, esborrar un guió l'elimina de la base privada de CloudKit. Per esborrar totes les dades de Cuevo a iCloud, obre Configuració, el teu compte d'Apple, iCloud, Gestiona l'emmagatzematge, Cuevo i elimina'n les dades."]),
        sec("photos", ("Exports and backups", "Exportaciones y copias", "Exportacions i còpies"), ["Deleting Cuevo does not remove videos you exported to Photos, Files or another app. Delete those copies in the destination app. Recently Deleted folders may retain them temporarily."], ["Borrar Cuevo no elimina los vídeos exportados a Fotos, Archivos u otra app. Borra esas copias en la app de destino. Las carpetas Eliminado recientemente pueden conservarlas temporalmente."], ["Esborrar Cuevo no elimina els vídeos exportats a Fotos, Fitxers o una altra app. Esborra aquestes còpies a l'app de destinació. Les carpetes Eliminat recentment les poden conservar temporalment."]),
        sec("subscription", ("Subscription records", "Registros de suscripción", "Registres de subscripció"), ["Deleting app data does not cancel Cuevo Pro. Cancel it in App Store subscription settings. To request deletion of RevenueCat's record, email " + PRIVACY + " with the subject 'Cuevo data deletion' and your Apple order ID. Apple retains its own purchase records under its policies."], ["Borrar datos no cancela Cuevo Pro. Cancélalo en los ajustes de suscripciones del App Store. Para pedir que se elimine el registro de RevenueCat, escribe a " + PRIVACY + " con el asunto 'Eliminación de datos de Cuevo' y tu ID de pedido de Apple. Apple conserva sus propios registros según sus políticas."], ["Esborrar dades no cancel·la Cuevo Pro. Cancel·la'l als ajustos de subscripcions de l'App Store. Per demanar que s'elimini el registre de RevenueCat, escriu a " + PRIVACY + " amb l'assumpte 'Eliminació de dades de Cuevo' i el teu ID de comanda d'Apple. Apple conserva els seus registres segons les seves polítiques."]),
        sec("response", ("Response time", "Plazo de respuesta", "Termini de resposta"), ["We process verified deletion requests within 30 days."], ["Tramitamos las solicitudes verificadas en un plazo de 30 días."], ["Tramitem les sol·licituds verificades en un termini de 30 dies."]),
    ],
)

payload = {
    "runId": "2026-W40-cuevo",
    "slug": "cuevo",
    "supportEmail": SUPPORT,
    "legal": {"documents": [privacy, terms, contact, deletion]},
}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cuevo-legal.json")
with open(out, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=1)
print("wrote", out)
